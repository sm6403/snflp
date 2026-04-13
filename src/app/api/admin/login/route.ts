import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminSessionCookie } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { username, password } = await request.json() as { username: string; password: string };

  // 1. Check superadmin env-var credentials
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie());
    return response;
  }

  // 2. Check DB admin users
  const adminUser = await prisma.adminUser.findUnique({ where: { username } });
  if (adminUser && await bcrypt.compare(password, adminUser.hashedPassword)) {
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie(adminUser.id));
    return response;
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
