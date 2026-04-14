import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { verifyAdminSession } from "@/lib/admin-auth";

const COOKIE_NAME = "admin_session";

// PATCH /api/admin/password
// Changes the password for the currently logged-in DB admin user.
// Not available to the superadmin (env-var credentials).
export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract adminId from cookie — superadmin sessions have no DB id
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const token = cookie?.value?.split(".")[0] ?? "";
  if (!token.startsWith("admin:user:")) {
    return NextResponse.json(
      { error: "Password changes are not available for the superadmin account" },
      { status: 403 }
    );
  }

  const adminId = token.slice("admin:user:".length);
  const body = await request.json() as { currentPassword?: string; newPassword?: string };
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { hashedPassword: true },
  });
  if (!adminUser) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(currentPassword, adminUser.hashedPassword);
  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { hashedPassword: hashed },
  });

  return NextResponse.json({ success: true });
}
