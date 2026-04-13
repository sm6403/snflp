import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
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

  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
      disabled: disabled ?? false,
    },
    select: { id: true, name: true, email: true, disabled: true, lastLoginAt: true, createdAt: true },
  });

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

  return NextResponse.json({ user });
}
