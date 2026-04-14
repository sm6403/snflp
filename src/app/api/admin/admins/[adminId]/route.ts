import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyIsSuperAdmin, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

// PATCH /api/admin/admins/[adminId] — change password (superadmin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ adminId: string }> }
) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adminId } = await params;
  const body = await request.json() as { password?: string; disabled?: boolean };

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const caller = await getAdminName();

  // Toggle disabled status
  if (typeof body.disabled === "boolean") {
    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: { disabled: body.disabled },
      select: { id: true, username: true, disabled: true, createdAt: true, lastLoginAt: true },
    });
    await logAdminAction(caller ?? "superadmin", body.disabled ? "DISABLE_ADMIN" : "ENABLE_ADMIN", { username: admin.username });
    return NextResponse.json({ admin: updated });
  }

  // Change password
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(body.password, 12);
    await prisma.adminUser.update({ where: { id: adminId }, data: { hashedPassword } });
    await logAdminAction(caller ?? "superadmin", "CHANGE_ADMIN_PASSWORD", { username: admin.username });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

// DELETE /api/admin/admins/[adminId] — remove a DB admin account (superadmin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ adminId: string }> }
) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adminId } = await params;

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const caller = await getAdminName();
  await logAdminAction(caller ?? "superadmin", "DELETE_ADMIN", { username: admin.username });

  await prisma.adminUser.delete({ where: { id: adminId } });
  return NextResponse.json({ deleted: true });
}
