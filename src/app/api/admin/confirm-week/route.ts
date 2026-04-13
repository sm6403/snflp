import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// POST /api/admin/confirm-week
// Bulk-grades all picks for the week, stamps Week.confirmedAt, and
// recomputes cumulative team records (W-L-T) for all teams that have
// played confirmed games in this season.
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
    include: {
      games: {
        select: { id: true, homeTeamId: true, awayTeamId: true, winnerId: true, isTie: true },
      },
    },
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
    // ── Grade picks ──────────────────────────────────────────────────────────
    for (const game of week.games) {
      // Reset any existing grades (handles re-confirmation)
      await tx.pick.updateMany({
        where: { gameId: game.id },
        data: { isCorrect: null },
      });

      if (game.isTie) {
        // Tied game: everyone loses — all picks are incorrect
        await tx.pick.updateMany({
          where: { gameId: game.id },
          data: { isCorrect: false },
        });
        continue;
      }

      const winnerId = game.winnerId!;

      // Correct picks
      const correct = await tx.pick.updateMany({
        where: { gameId: game.id, pickedTeamId: winnerId },
        data: { isCorrect: true },
      });
      // Wrong picks (picked the losing team)
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

    // ── Recompute team records ────────────────────────────────────────────────
    // Fetch all previously confirmed games in this season (other weeks)
    const previousGames = await tx.game.findMany({
      where: {
        weekId: { not: weekId },
        week: { seasonId: week.seasonId, confirmedAt: { not: null } },
      },
      select: { homeTeamId: true, awayTeamId: true, winnerId: true, isTie: true },
    });

    // Combine with this week's just-confirmed games
    const allConfirmedGames = [
      ...previousGames,
      ...week.games.map((g) => ({
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        winnerId: g.winnerId,
        isTie: g.isTie,
      })),
    ];

    // Accumulate W-L-T per team
    const records = new Map<string, { wins: number; losses: number; ties: number }>();
    for (const game of allConfirmedGames) {
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (!records.has(teamId)) records.set(teamId, { wins: 0, losses: 0, ties: 0 });
        const r = records.get(teamId)!;
        if (game.isTie) {
          r.ties++;
        } else if (game.winnerId === teamId) {
          r.wins++;
        } else if (game.winnerId !== null) {
          r.losses++;
        }
      }
    }

    // Upsert a TeamRecord for each team keyed to the just-confirmed week
    for (const [teamId, record] of records) {
      await tx.teamRecord.upsert({
        where: { teamId_weekId: { teamId, weekId } },
        create: { teamId, weekId, ...record },
        update: record,
      });
    }
  });

  const updatedWeek = await prisma.week.findUnique({ where: { id: weekId } });
  return NextResponse.json({ week: updatedWeek, gradedCount });
}
