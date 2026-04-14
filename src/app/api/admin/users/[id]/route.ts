import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";
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
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });

  return NextResponse.json({ user });
}
