import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName, getAdminSession } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { logAdminAction } from "@/lib/admin-log";
import { NFL_TEAMS } from "@/lib/nfl-teams";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  alias: true,
  favoriteTeam: true,
  favoriteTeamLocked: true,
  disabled: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const getAdminSess = await getAdminSession();
  const getLeagueId = await getAdminLeagueId(getAdminSess);
  if (getLeagueId) {
    const membership = await prisma.userLeague.findUnique({
      where: { userId_leagueId: { userId: id, leagueId: getLeagueId } },
    });
    if (!membership) return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Include division context for the current active season (if it uses divisions)
  // Scope to admin's league so we don't leak divisions from other leagues
  const currentSeason = await prisma.season.findFirst({
    where: getLeagueId ? { isCurrent: true, leagueId: getLeagueId } : { isCurrent: true },
    select: {
      id: true,
      year: true,
      type: true,
      usesDivisions: true,
      divisions: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, isDefault: true },
      },
    },
  });

  let divisionContext = null;
  if (currentSeason?.usesDivisions) {
    const membership = await prisma.userDivision.findUnique({
      where: { userId_seasonId: { userId: id, seasonId: currentSeason.id } },
      select: { divisionId: true },
    });
    const defaultDiv = currentSeason.divisions.find((d) => d.isDefault);
    divisionContext = {
      seasonId: currentSeason.id,
      seasonName: `${currentSeason.year} ${currentSeason.type === "postseason" ? "Post-Season" : "Regular Season"}`,
      divisions: currentSeason.divisions,
      currentDivisionId: membership?.divisionId ?? defaultDiv?.id ?? null,
    };
  }

  return NextResponse.json({ user, divisionContext });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const delAdminSess = await getAdminSession();
  const delLeagueId = await getAdminLeagueId(delAdminSess);
  if (delLeagueId) {
    const membership = await prisma.userLeague.findUnique({
      where: { userId_leagueId: { userId: id, leagueId: delLeagueId } },
    });
    if (!membership) return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete in dependency order: picks → pick sets → user
  await prisma.$transaction(async (tx) => {
    const pickSets = await tx.pickSet.findMany({
      where: { userId: id },
      select: { id: true },
    });
    const pickSetIds = pickSets.map((ps) => ps.id);

    if (pickSetIds.length > 0) {
      await tx.pick.deleteMany({ where: { pickSetId: { in: pickSetIds } } });
      await tx.pickSet.deleteMany({ where: { id: { in: pickSetIds } } });
    }

    await tx.user.delete({ where: { id } });
  });

  const adminName = await getAdminName() ?? "unknown";
  await logAdminAction(adminName, "DELETE_USER", { email: user.email, name: user.name });

  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const patchAdminSess = await getAdminSession();
  const patchLeagueId = await getAdminLeagueId(patchAdminSess);
  if (patchLeagueId) {
    const membership = await prisma.userLeague.findUnique({
      where: { userId_leagueId: { userId: id, leagueId: patchLeagueId } },
    });
    if (!membership) return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.password) {
    data.hashedPassword = await bcrypt.hash(body.password, 10);
  }
  if (typeof body.alias === "string") {
    data.alias = body.alias || null;
  }
  if (typeof body.disabled === "boolean") {
    data.disabled = body.disabled;
  }
  if (typeof body.name === "string") {
    data.name = body.name || null;
  }
  if (typeof body.favoriteTeam === "string") {
    if (!NFL_TEAMS.includes(body.favoriteTeam as typeof NFL_TEAMS[number])) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }
    data.favoriteTeam = body.favoriteTeam;
  }
  if (typeof body.favoriteTeamLocked === "boolean") {
    data.favoriteTeamLocked = body.favoriteTeamLocked;
  }

  // Division assignment — handled separately from the main user update
  if (typeof body.divisionId === "string" && typeof body.seasonId === "string") {
    const division = await prisma.division.findFirst({
      where: { id: body.divisionId, seasonId: body.seasonId },
    });
    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 });
    }
    await prisma.userDivision.upsert({
      where: { userId_seasonId: { userId: id, seasonId: body.seasonId } },
      create: { userId: id, seasonId: body.seasonId, divisionId: body.divisionId },
      update: { divisionId: body.divisionId },
    });
    // Allow returning early if only division was changed
    if (Object.keys(data).length === 0) {
      const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
      return NextResponse.json({ user });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });

  const adminName = await getAdminName() ?? "unknown";
  // Summarise what changed (omit hashed password from log)
  const changes = Object.keys(body).filter((k) => k !== "password");
  if (body.password) changes.push("password");
  await logAdminAction(adminName, "UPDATE_USER", { email: user.email, changes });

  return NextResponse.json({ user });
}
