import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIsSuperAdmin } from "@/lib/admin-auth";

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

  await prisma.adminUser.delete({ where: { id: adminId } });
  return NextResponse.json({ deleted: true });
}
