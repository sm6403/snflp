import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      favoriteTeam: true,
      disabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
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

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      favoriteTeam: true,
      disabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}
