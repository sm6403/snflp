import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-log";

/**
 * Core confirm-week business logic, shared between:
 *   POST /api/admin/confirm-week   (manual, admin session)
 *   GET  /api/cron/auto-results    (automated, CRON_SECRET)
 *
 * Preconditions (callers must verify before calling):
 *   - Week exists and lockedForSubmission = true
 *   - All games have a winnerId set or isTie = true
 *
 * Phases:
 *   1. Grade picks (one small transaction per game, avoids Neon pooler timeout)
 *   2. Stamp week.confirmedAt
 *   3. Recompute cumulative team W-L-T records for the season
 *   4. Favourite team bonus win (if season rule enabled)
 *   5. Last Man Standing elimination (if season rule enabled)
 */
export async function confirmWeek(
  weekId: string,
  callerName: string
): Promise<{ picksGraded: number; confirmedAt: Date }> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      games: {
        select: { id: true, homeTeamId: true, awayTeamId: true, winnerId: true, isTie: true },
      },
      season: {
        select: {
          id: true,
          leagueId: true,
          ruleFavouriteTeamBonusWin: true,
          ruleLMS: true,
          ruleLMSRound: true,
        },
      },
    },
  });

  if (!week) throw new Error(`Week not found: ${weekId}`);
  if (!week.lockedForSubmission) throw new Error("Week must be locked before confirming results");

  const unresolved = week.games.filter((g) => g.winnerId === null && !g.isTie);
  if (unresolved.length > 0) {
    throw new Error(
      `${unresolved.length} game${unresolved.length !== 1 ? "s" : ""} still need a winner (or tie) set`
    );
  }

  let gradedCount = 0;

  // ── Phase 1: Grade picks — one small transaction per game ────────────────────
  for (const game of week.games) {
    await prisma.$transaction(async (tx) => {
      await tx.pick.updateMany({ where: { gameId: game.id }, data: { isCorrect: null } });

      if (game.isTie) {
        await tx.pick.updateMany({ where: { gameId: game.id }, data: { isCorrect: false } });
        return;
      }

      const winnerId = game.winnerId!;
      const correct = await tx.pick.updateMany({
        where: { gameId: game.id, pickedTeamId: winnerId },
        data: { isCorrect: true },
      });
      await tx.pick.updateMany({
        where: { gameId: game.id, NOT: { pickedTeamId: winnerId }, pickedTeamId: { not: null } },
        data: { isCorrect: false },
      });
      await tx.pick.updateMany({
        where: { gameId: game.id, pickedTeamId: null },
        data: { isCorrect: false },
      });
      gradedCount += correct.count;
    });
  }

  // ── Phase 2: Stamp the week as confirmed ─────────────────────────────────────
  const confirmedAt = new Date();
  await prisma.week.update({ where: { id: weekId }, data: { confirmedAt } });

  // ── Phase 3: Recompute cumulative team records ───────────────────────────────
  const previousGames = await prisma.game.findMany({
    where: {
      weekId: { not: weekId },
      week: { seasonId: week.seasonId, confirmedAt: { not: null } },
    },
    select: { homeTeamId: true, awayTeamId: true, winnerId: true, isTie: true },
  });

  const allConfirmedGames = [
    ...previousGames,
    ...week.games.map((g) => ({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      winnerId: g.winnerId,
      isTie: g.isTie,
    })),
  ];

  const records = new Map<string, { wins: number; losses: number; ties: number }>();
  for (const game of allConfirmedGames) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (!records.has(teamId)) records.set(teamId, { wins: 0, losses: 0, ties: 0 });
      const r = records.get(teamId)!;
      if (game.isTie) r.ties++;
      else if (game.winnerId === teamId) r.wins++;
      else if (game.winnerId !== null) r.losses++;
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [teamId, record] of records) {
      await tx.teamRecord.upsert({
        where: { teamId_weekId: { teamId, weekId } },
        create: { teamId, weekId, ...record },
        update: record,
      });
    }
  });

  // ── Phase 4: Favourite team bonus win ────────────────────────────────────────
  if (week.season.ruleFavouriteTeamBonusWin) {
    const pickSetsWithUsers = await prisma.pickSet.findMany({
      where: { weekId },
      select: {
        user: { select: { favoriteTeam: true } },
        picks: { where: { isCorrect: false }, select: { id: true, pickedTeamId: true } },
      },
    });
    const favTeamNames = [...new Set(pickSetsWithUsers.map((ps) => ps.user.favoriteTeam))];
    const favTeams = await prisma.team.findMany({
      where: { name: { in: favTeamNames } },
      select: { id: true, name: true },
    });
    const nameToId = new Map(favTeams.map((t) => [t.name, t.id]));
    const bonusPickIds: string[] = [];
    for (const ps of pickSetsWithUsers) {
      const favTeamId = nameToId.get(ps.user.favoriteTeam);
      if (!favTeamId) continue;
      for (const pick of ps.picks) {
        if (pick.pickedTeamId === favTeamId) bonusPickIds.push(pick.id);
      }
    }
    if (bonusPickIds.length > 0) {
      await prisma.pick.updateMany({ where: { id: { in: bonusPickIds } }, data: { isCorrect: true } });
      gradedCount += bonusPickIds.length;
    }
  }

  // ── Phase 5: Last Man Standing elimination ──────────────────────────────────
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

    const currentRound = week.season.ruleLMSRound;
    const weekLmsPicks = await prisma.lmsPick.findMany({ where: { weekId, lmsRound: currentRound } });

    for (const pick of weekLmsPicks) {
      if (pick.teamId && losingTeamIds.has(pick.teamId)) {
        await prisma.lmsPick.update({ where: { id: pick.id }, data: { eliminated: true } });
      }
    }

    // Auto-eliminate users who didn't submit, scoped to the season's league
    const eligibleUsers = await prisma.user.findMany({
      where: {
        showOnLeaderboard: true,
        userLeagues: { some: { leagueId: week.season.leagueId } },
      },
      select: { id: true },
    });

    const submittedUserIds = new Set(weekLmsPicks.map((p) => p.userId));
    const alreadyEliminated = await prisma.lmsPick.findMany({
      where: { seasonId: week.seasonId, lmsRound: currentRound, eliminated: true, weekId: { not: weekId } },
      select: { userId: true },
    });
    const alreadyEliminatedIds = new Set(alreadyEliminated.map((p) => p.userId));

    for (const user of eligibleUsers) {
      if (!submittedUserIds.has(user.id) && !alreadyEliminatedIds.has(user.id)) {
        await prisma.lmsPick.upsert({
          where: { userId_weekId: { userId: user.id, weekId } },
          create: { userId: user.id, weekId, seasonId: week.seasonId, lmsRound: currentRound, eliminated: true },
          update: { eliminated: true },
        });
      }
    }
  }

  await logAdminAction(callerName, "CONFIRM_RESULTS", {
    weekId,
    weekLabel: week.label,
    seasonYear: week.season.id,
    gradedCount,
  });

  return { picksGraded: gradedCount, confirmedAt };
}
