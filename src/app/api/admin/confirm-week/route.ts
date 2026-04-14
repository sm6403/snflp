import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

// POST /api/admin/confirm-week
// Bulk-grades all picks for the week, stamps Week.confirmedAt, and
// recomputes cumulative team records (W-L-T) for all teams that have
// played confirmed games in this season.
//
// Intentionally split into small sequential operations rather than one
// large transaction — Neon's connection pooler drops long-running
// transactions, causing network errors on weeks with many games/players.
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
      season: { select: { id: true, ruleFavouriteTeamBonusWin: true, ruleLMS: true } },
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

  // ── Phase 1: Grade picks — one small transaction per game ────────────────────
  for (const game of week.games) {
    await prisma.$transaction(async (tx) => {
      // Reset any existing grades (handles re-confirmation)
      await tx.pick.updateMany({
        where: { gameId: game.id },
        data: { isCorrect: null },
      });

      if (game.isTie) {
        // Tied game: everyone loses
        await tx.pick.updateMany({
          where: { gameId: game.id },
          data: { isCorrect: false },
        });
        return;
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
    });
  }

  // ── Phase 2: Stamp the week as confirmed ─────────────────────────────────────
  await prisma.week.update({
    where: { id: weekId },
    data: { confirmedAt: new Date() },
  });

  // ── Phase 3: Recompute cumulative team records ───────────────────────────────
  // Fetch all previously confirmed games in this season (other weeks)
  const previousGames = await prisma.game.findMany({
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

  // Upsert team records in a single small transaction
  await prisma.$transaction(async (tx) => {
    for (const [teamId, record] of records) {
      await tx.teamRecord.upsert({
        where: { teamId_weekId: { teamId, weekId } },
        create: { teamId, weekId, ...record },
        update: record,
      });
    }
  });

  // ── Phase 4: Custom rule — Favourite Team Bonus Win ──────────────────────────
  // Any pick for a player's favourite team counts as correct even if that
  // team lost. Applied after normal grading so it overrides incorrect picks.
  if (week.season.ruleFavouriteTeamBonusWin) {
    // Fetch pick sets + user favourite teams
    const pickSetsWithUsers = await prisma.pickSet.findMany({
      where: { weekId },
      select: {
        user: { select: { favoriteTeam: true } },
        picks: {
          where: { isCorrect: false },
          select: { id: true, pickedTeamId: true },
        },
      },
    });

    // Resolve unique favourite team names → IDs in one query
    const favTeamNames = [...new Set(pickSetsWithUsers.map((ps) => ps.user.favoriteTeam))];
    const favTeams = await prisma.team.findMany({
      where: { name: { in: favTeamNames } },
      select: { id: true, name: true },
    });
    const nameToId = new Map(favTeams.map((t) => [t.name, t.id]));

    // Collect IDs of incorrect picks that should be overridden to correct
    const bonusPickIds: string[] = [];
    for (const ps of pickSetsWithUsers) {
      const favTeamId = nameToId.get(ps.user.favoriteTeam);
      if (!favTeamId) continue;
      for (const pick of ps.picks) {
        if (pick.pickedTeamId === favTeamId) {
          bonusPickIds.push(pick.id);
        }
      }
    }

    if (bonusPickIds.length > 0) {
      await prisma.pick.updateMany({
        where: { id: { in: bonusPickIds } },
        data: { isCorrect: true },
      });
      gradedCount += bonusPickIds.length;
    }
  }

  // ── Phase 5: Last Man Standing elimination ──────────────────────────────────
  // If LMS rule is enabled, mark any LmsPick for this week as eliminated if
  // the player's chosen team lost (or tied — treated as a loss for LMS).
  if (week.season.ruleLMS) {
    const losingTeamIds = new Set<string>();
    for (const game of week.games) {
      if (game.winnerId) {
        const loserId = game.homeTeamId === game.winnerId ? game.awayTeamId : game.homeTeamId;
        losingTeamIds.add(loserId);
      } else if (game.isTie) {
        losingTeamIds.add(game.homeTeamId);
        losingTeamIds.add(game.awayTeamId);
      }
    }
    const weekLmsPicks = await prisma.lmsPick.findMany({ where: { weekId } });
    for (const pick of weekLmsPicks) {
      if (losingTeamIds.has(pick.teamId)) {
        await prisma.lmsPick.update({ where: { id: pick.id }, data: { eliminated: true } });
      }
    }
  }

  const updatedWeek = await prisma.week.findUnique({ where: { id: weekId } });

  const adminName = await getAdminName() ?? "unknown";
  await logAdminAction(adminName, "CONFIRM_RESULTS", {
    weekId,
    weekLabel: week.label,
    seasonYear: week.season.id,
    gradedCount,
  });

  return NextResponse.json({ week: updatedWeek, gradedCount });
}
