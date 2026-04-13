import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// POST /api/admin/reset-week
// Clears all picks, game results, and unlocks the week — test mode only safeguard on client
export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = await request.json() as { weekId: string };
  if (!weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete all picks for pick sets in this week (must go first — no cascade)
    await tx.pick.deleteMany({
      where: { pickSet: { weekId } },
    });

    // 2. Delete all pick sets for this week
    await tx.pickSet.deleteMany({ where: { weekId } });

    // 3. Clear all game winners for this week
    await tx.game.updateMany({
      where: { weekId },
      data: { winnerId: null },
    });

    // 4. Unlock the week and clear confirmation timestamp
    await tx.week.update({
      where: { id: weekId },
      data: { lockedForSubmission: false, confirmedAt: null },
    });
  });

  return NextResponse.json({ success: true });
}
