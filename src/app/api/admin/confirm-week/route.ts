import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// POST /api/admin/confirm-week
// Bulk-grades all picks for the week and stamps Week.confirmedAt.
// The admin enters individual game winners first (PATCH /api/admin/games/[gameId]),
// then calls this once to publish results to users.
export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = (await request.json()) as { weekId: string };
  if (!weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { games: { select: { id: true, winnerId: true, isTie: true } } },
  });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  if (!week.lockedForSubmission) {
    return NextResponse.json(
      { error: "Week must be locked before confirming results" },
      { status: 400 }
    );
  }

  // A game is "resolved" if it has a winner OR is marked as a tie
  const gamesWithoutWinner = week.games.filter((g) => g.winnerId === null && !g.isTie);
  if (gamesWithoutWinner.length > 0) {
    return NextResponse.json(
      {
        error: `${gamesWithoutWinner.length} game${gamesWithoutWinner.length !== 1 ? "s" : ""} still need a winner (or tie) set`,
      },
      { status: 400 }
    );
  }

  let gradedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const game of week.games) {
      // First reset any existing grades for this game (handles re-confirmation)
      await tx.pick.updateMany({
        where: { gameId: game.id },
        data: { isCorrect: null },
      });

      if (game.isTie) {
        // Tied game: no picks are graded — isCorrect stays null (neither right nor wrong)
        continue;
      }

      const winnerId = game.winnerId!;

      // Correct picks
      const correct = await tx.pick.updateMany({
        where: { gameId: game.id, pickedTeamId: winnerId },
        data: { isCorrect: true },
      });
      // Wrong picks (has a pick but it's the losing team)
      await tx.pick.updateMany({
        where: { gameId: game.id, NOT: { pickedTeamId: winnerId }, pickedTeamId: { not: null } },
        data: { isCorrect: false },
      });
      // Missed picks (null pickedTeamId — time-locked game with no selection)
      await tx.pick.updateMany({
        where: { gameId: game.id, pickedTeamId: null },
        data: { isCorrect: false },
      });

      gradedCount += correct.count;
    }

    // Stamp the week as confirmed (idempotent — updates timestamp on re-confirm)
    await tx.week.update({
      where: { id: weekId },
      data: { confirmedAt: new Date() },
    });
  });

  const updatedWeek = await prisma.week.findUnique({ where: { id: weekId } });
  return NextResponse.json({ week: updatedWeek, gradedCount });
}
