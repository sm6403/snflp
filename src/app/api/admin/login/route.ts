import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminSessionCookie } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { username, password } = await request.json() as { username: string; password: string };

  // 1. Check superadmin env-var credentials
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASSWORD
  ) {
    await logAdminAction("superadmin", "LOGIN", {});
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie());
    return response;
  }

  // 2. Check DB admin users
  const adminUser = await prisma.adminUser.findUnique({ where: { username } });
  if (adminUser?.disabled) {
    return NextResponse.json({ error: "This account has been disabled" }, { status: 403 });
  }
  if (adminUser && await bcrypt.compare(password, adminUser.hashedPassword)) {
    // Update last login timestamp
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });
    await logAdminAction(adminUser.username, "LOGIN", {});
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie(adminUser.id));
    return response;
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
