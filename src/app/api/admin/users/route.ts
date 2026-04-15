import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName, getAdminSession } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { logAdminAction } from "@/lib/admin-log";

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSession = await getAdminSession();
  const leagueId = adminSession?.role === "admin"
    ? await getAdminLeagueId(adminSession)
    : null;

  const users = await prisma.user.findMany({
    where: leagueId ? { userLeagues: { some: { leagueId } } } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      favoriteTeam: true,
      disabled: true,
      showOnLeaderboard: true,
      lastLoginAt: true,
      createdAt: true,
      userLeagues: {
        select: { league: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, disabled } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const postAdminSession = await getAdminSession();
  const postLeagueId = await getAdminLeagueId(postAdminSession);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
      alias: name ?? null,
      disabled: disabled ?? false,
    },
    select: { id: true, name: true, email: true, disabled: true, lastLoginAt: true, createdAt: true },
  });

  if (postLeagueId) {
    await prisma.userLeague.create({
      data: { userId: user.id, leagueId: postLeagueId },
    });
  }

  const adminName = await getAdminName() ?? "unknown";
  await logAdminAction(adminName, "CREATE_USER", { email: user.email, name: user.name });

  return NextResponse.json({ user }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    userId?: string;
    disabled?: boolean;
    showOnLeaderboard?: boolean;
  };

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const updates: { disabled?: boolean; showOnLeaderboard?: boolean } = {};
  if (typeof body.disabled === "boolean") updates.disabled = body.disabled;
  if (typeof body.showOnLeaderboard === "boolean") updates.showOnLeaderboard = body.showOnLeaderboard;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: body.userId },
    data: updates,
    select: { id: true, name: true, email: true, disabled: true, showOnLeaderboard: true, lastLoginAt: true, createdAt: true },
  });

  const adminName2 = await getAdminName() ?? "unknown";
  await logAdminAction(adminName2, "UPDATE_USER", { email: user.email, changes: updates });

  return NextResponse.json({ user });
}
