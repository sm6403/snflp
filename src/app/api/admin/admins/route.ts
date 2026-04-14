import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyIsSuperAdmin, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

// GET /api/admin/admins — list all DB admin accounts (superadmin only)
export async function GET() {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admins = await prisma.adminUser.findMany({
    select: { id: true, username: true, createdAt: true, lastLoginAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

// POST /api/admin/admins — create a new DB admin account (superadmin only)
export async function POST(request: Request) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password } = await request.json() as { username: string; password: string };

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.create({
    data: { username: username.trim(), hashedPassword },
    select: { id: true, username: true, createdAt: true, lastLoginAt: true },
  });

  const caller = await getAdminName();
  await logAdminAction(caller ?? "superadmin", "CREATE_ADMIN", { username: admin.username });

  return NextResponse.json({ admin }, { status: 201 });
}
