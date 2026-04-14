import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ seasonId: string; divisionId: string }> };

// PATCH /api/admin/seasons/[seasonId]/divisions/[divisionId]
// Rename a division.
export async function PATCH(request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { seasonId, divisionId } = await params;

  const division = await prisma.division.findUnique({
    where: { id: divisionId },
  });
  if (!division || division.seasonId !== seasonId) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Division name is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.division.update({
      where: { id: divisionId },
      data: { name: name.trim() },
      include: { _count: { select: { userDivisions: true } } },
    });
    return NextResponse.json({ division: updated });
  } catch {
    return NextResponse.json({ error: "A division with that name already exists" }, { status: 409 });
  }
}

// DELETE /api/admin/seasons/[seasonId]/divisions/[divisionId]
// Deletes a non-default division, moving its members to the default division.
export async function DELETE(_request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { seasonId, divisionId } = await params;

  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division || division.seasonId !== seasonId) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }
  if (division.isDefault) {
    return NextResponse.json({ error: "Cannot delete the default division" }, { status: 400 });
  }

  // Move members to the default division, or delete the assignment if none exists
  const defaultDiv = await prisma.division.findFirst({
    where: { seasonId, isDefault: true },
  });

  await prisma.$transaction(async (tx) => {
    if (defaultDiv) {
      // Re-point all UserDivision rows to default
      await tx.userDivision.updateMany({
        where: { divisionId, seasonId },
        data: { divisionId: defaultDiv.id },
      });
    } else {
      // No default exists — just remove the assignments
      await tx.userDivision.deleteMany({ where: { divisionId, seasonId } });
    }
    await tx.division.delete({ where: { id: divisionId } });
  });

  return NextResponse.json({ deleted: true });
}
