import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard/week/[weekId]
// Returns all users who submitted picks for a specific week, ranked.
// Only available for weeks where confirmedAt IS NOT NULL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const session = await auth();
  const isAdmin = !session?.user?.id && (await verifyAdminSession());
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session?.user?.id ?? "";

  const { weekId } = await params;

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { id: true, number: true, label: true, confirmedAt: true },
  });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  if (!week.confirmedAt) {
    return NextResponse.json(
      { error: "Results have not been confirmed for this week" },
      { status: 403 }
    );
  }

  // Fetch all pick sets for this week with pick correctness
  const pickSets = await prisma.pickSet.findMany({
    where: { weekId },
    select: {
      userId: true,
      user: { select: { id: true, name: true, alias: true, email: true, disabled: true, showOnLeaderboard: true } },
      picks: { select: { isCorrect: true } },
    },
  });

  const ranked = pickSets
    .filter((ps) => !ps.user.disabled && ps.user.showOnLeaderboard)
    .map((ps) => {
      const graded = ps.picks.filter((p) => p.isCorrect !== null);
      const correct = graded.filter((p) => p.isCorrect === true).length;
      const total = ps.picks.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const displayName = ps.user.alias ?? ps.user.name ?? ps.user.email;
      return { userId: ps.userId, displayName, correct, total, pct };
    })
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      if (b.pct !== a.pct) return b.pct - a.pct;
      return a.displayName.localeCompare(b.displayName);
    })
    .map((u, idx) => ({ ...u, rank: idx + 1 }));

  return NextResponse.json({
    week,
    currentUserId,
    users: ranked,
  });
}
