import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserLeagueId } from "@/lib/league-context";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const leagueId = await resolveUserLeagueId(userId);
  if (!leagueId) {
    return NextResponse.json(null);
  }

  const season = await prisma.season.findFirst({
    where: { isCurrent: true, leagueId },
    select: { id: true },
  });
  if (!season) {
    return NextResponse.json(null);
  }

  // All confirmed weeks, most recent first
  const confirmedWeeks = await prisma.week.findMany({
    where: { seasonId: season.id, confirmedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { id: true, number: true, label: true },
  });
  if (confirmedWeeks.length === 0) {
    return NextResponse.json(null);
  }

  const confirmedWeekIds = confirmedWeeks.map((w) => w.id);

  // ── User's own pick sets — includes game data for bias/upset stats ─────────
  const userPickSets = await prisma.pickSet.findMany({
    where: { userId, weekId: { in: confirmedWeekIds } },
    select: {
      weekId: true,
      picks: {
        select: {
          pickedTeamId: true,
          isCorrect: true,
          pickedTeam: {
            select: { name: true, abbreviation: true, espnId: true },
          },
          game: {
            select: {
              homeTeamId: true,
              awayTeamId: true,
              winnerId: true,
              isTie: true,
            },
          },
        },
      },
    },
  });

  const pickSetByWeekId = new Map(userPickSets.map((ps) => [ps.weekId, ps]));

  // ── 1. Current week streak (consecutive confirmed weeks ≥ 50% correct) ────
  let streak = 0;
  for (const week of confirmedWeeks) {
    const ps = pickSetByWeekId.get(week.id);
    if (!ps) break;
    const graded = ps.picks.filter((p) => p.isCorrect !== null);
    const correct = graded.filter((p) => p.isCorrect).length;
    if (graded.length === 0 || correct / graded.length < 0.5) break;
    streak++;
  }

  // ── 2. Best / Worst week  3. Perfect weeks ────────────────────────────────
  let bestWeekPct: number | null = null;
  let bestWeekLabel = "";
  let bestWeekCorrect = 0;
  let bestWeekGraded = 0;
  let worstWeekPct: number | null = null;
  let worstWeekLabel = "";
  let worstWeekCorrect = 0;
  let worstWeekGraded = 0;
  let perfectWeeks = 0;
  let totalCorrect = 0;
  let totalGraded = 0;

  for (const week of confirmedWeeks) {
    const ps = pickSetByWeekId.get(week.id);
    if (!ps) continue;
    const graded = ps.picks.filter((p) => p.isCorrect !== null);
    const correct = graded.filter((p) => p.isCorrect).length;
    if (graded.length === 0) continue;

    totalCorrect += correct;
    totalGraded += graded.length;

    const pct = correct / graded.length;

    if (bestWeekPct === null || pct > bestWeekPct / 100) {
      bestWeekPct = Math.round(pct * 100);
      bestWeekLabel = week.label;
      bestWeekCorrect = correct;
      bestWeekGraded = graded.length;
    }
    if (worstWeekPct === null || pct < worstWeekPct / 100) {
      worstWeekPct = Math.round(pct * 100);
      worstWeekLabel = week.label;
      worstWeekCorrect = correct;
      worstWeekGraded = graded.length;
    }
    if (correct === graded.length) perfectWeeks++;
  }

  // ── 4. Home team bias ──────────────────────────────────────────────────────
  let homePickCount = 0;
  let awayPickCount = 0;
  let homeCorrect = 0;
  let awayCorrect = 0;

  for (const ps of userPickSets) {
    for (const pick of ps.picks) {
      if (!pick.pickedTeamId || pick.isCorrect === null) continue;
      if (pick.pickedTeamId === pick.game.homeTeamId) {
        homePickCount++;
        if (pick.isCorrect) homeCorrect++;
      } else {
        awayPickCount++;
        if (pick.isCorrect) awayCorrect++;
      }
    }
  }

  const totalBiasPicks = homePickCount + awayPickCount;
  const homePickPct =
    totalBiasPicks > 0 ? Math.round((homePickCount / totalBiasPicks) * 100) : null;
  const homeAccuracy =
    homePickCount > 0 ? Math.round((homeCorrect / homePickCount) * 100) : null;
  const awayAccuracy =
    awayPickCount > 0 ? Math.round((awayCorrect / awayPickCount) * 100) : null;

  // ── 5. Upset accuracy (correct picks where the away team won) ─────────────
  let upsetOpportunities = 0;
  let upsetCorrect = 0;

  for (const ps of userPickSets) {
    for (const pick of ps.picks) {
      if (pick.isCorrect === null || !pick.game.winnerId || pick.game.isTie) continue;
      if (pick.game.winnerId === pick.game.awayTeamId) {
        upsetOpportunities++;
        if (pick.isCorrect) upsetCorrect++;
      }
    }
  }

  const upsetAccuracy =
    upsetOpportunities > 0
      ? Math.round((upsetCorrect / upsetOpportunities) * 100)
      : null;

  // ── 6. Most picked team ────────────────────────────────────────────────────
  const teamPickCounts = new Map<
    string,
    { name: string; abbreviation: string; espnId: string; count: number }
  >();

  for (const ps of userPickSets) {
    for (const pick of ps.picks) {
      if (!pick.pickedTeamId || !pick.pickedTeam) continue;
      const existing = teamPickCounts.get(pick.pickedTeamId) ?? {
        name: pick.pickedTeam.name,
        abbreviation: pick.pickedTeam.abbreviation,
        espnId: pick.pickedTeam.espnId,
        count: 0,
      };
      existing.count++;
      teamPickCounts.set(pick.pickedTeamId, existing);
    }
  }

  let mostPickedTeam: { name: string; abbreviation: string; espnId: string } | null = null;
  let mostPickedCount = 0;
  for (const [, v] of teamPickCounts) {
    if (v.count > mostPickedCount) {
      mostPickedCount = v.count;
      mostPickedTeam = { name: v.name, abbreviation: v.abbreviation, espnId: v.espnId };
    }
  }

  // ── 7 & 8. Season rank, this-week rank, and head-to-head vs league ────────
  const [leagueUsers, allPickSets] = await Promise.all([
    prisma.user.findMany({
      where: {
        disabled: false,
        showOnLeaderboard: true,
        userLeagues: { some: { leagueId } },
      },
      select: { id: true, name: true, alias: true, email: true },
    }),
    prisma.pickSet.findMany({
      where: { weekId: { in: confirmedWeekIds } },
      select: {
        userId: true,
        weekId: true,
        picks: { select: { isCorrect: true } },
      },
    }),
  ]);

  function computeScores(
    sets: typeof allPickSets,
    weekIds: Set<string>
  ): Map<string, { correct: number; graded: number }> {
    const map = new Map<string, { correct: number; graded: number }>();
    for (const ps of sets) {
      if (!weekIds.has(ps.weekId)) continue;
      const prev = map.get(ps.userId) ?? { correct: 0, graded: 0 };
      for (const p of ps.picks) {
        if (p.isCorrect !== null) {
          prev.graded++;
          if (p.isCorrect) prev.correct++;
        }
      }
      map.set(ps.userId, prev);
    }
    return map;
  }

  function rankUsers(
    scores: Map<string, { correct: number; graded: number }>,
    users: typeof leagueUsers
  ): Map<string, number> {
    const sorted = users
      .map((u) => {
        const s = scores.get(u.id) ?? { correct: 0, graded: 0 };
        const pct = s.graded > 0 ? s.correct / s.graded : 0;
        return {
          userId: u.id,
          correct: s.correct,
          pct,
          displayName: u.alias ?? u.name ?? u.email ?? "",
        };
      })
      .sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        if (b.pct !== a.pct) return b.pct - a.pct;
        return a.displayName.localeCompare(b.displayName);
      });
    const map = new Map<string, number>();
    sorted.forEach((u, i) => map.set(u.userId, i + 1));
    return map;
  }

  const allWeeksSet = new Set(confirmedWeekIds);
  const mostRecentWeekId = confirmedWeeks[0].id;
  const weeklySet = new Set([mostRecentWeekId]);

  const seasonScores = computeScores(allPickSets, allWeeksSet);
  const weeklyScores = computeScores(allPickSets, weeklySet);
  const seasonRankMap = rankUsers(seasonScores, leagueUsers);
  const weeklyRankMap = rankUsers(weeklyScores, leagueUsers);

  const mySeasonRank = seasonRankMap.get(userId) ?? null;
  const myWeeklyRank = weeklyRankMap.get(userId) ?? null;
  const totalPlayers = leagueUsers.length;

  // League-wide overall accuracy (all users, all confirmed weeks)
  let leagueTotal = 0;
  let leagueTotalGames = 0;
  for (const ps of allPickSets) {
    for (const p of ps.picks) {
      if (p.isCorrect !== null) {
        leagueTotalGames++;
        if (p.isCorrect) leagueTotal++;
      }
    }
  }
  const leagueAvgPct =
    leagueTotalGames > 0 ? Math.round((leagueTotal / leagueTotalGames) * 100) : null;
  const userOverallPct =
    totalGraded > 0 ? Math.round((totalCorrect / totalGraded) * 100) : null;
  const vsLeagueDelta =
    userOverallPct !== null && leagueAvgPct !== null
      ? userOverallPct - leagueAvgPct
      : null;

  // ── 9. Rolling 4-week accuracy ─────────────────────────────────────────────
  const last4Weeks = confirmedWeeks.slice(0, 4);
  let rolling4Correct = 0;
  let rolling4Graded = 0;
  for (const w of last4Weeks) {
    const ps = pickSetByWeekId.get(w.id);
    if (!ps) continue;
    for (const p of ps.picks) {
      if (p.isCorrect !== null) {
        rolling4Graded++;
        if (p.isCorrect) rolling4Correct++;
      }
    }
  }
  const rolling4Pct =
    rolling4Graded > 0 ? Math.round((rolling4Correct / rolling4Graded) * 100) : null;

  return NextResponse.json({
    streak,
    bestWeekPct,
    bestWeekLabel,
    bestWeekCorrect,
    bestWeekGraded,
    worstWeekPct,
    worstWeekLabel,
    worstWeekCorrect,
    worstWeekGraded,
    perfectWeeks,
    homePickPct,
    homePickCount,
    awayPickCount,
    homeAccuracy,
    awayAccuracy,
    upsetAccuracy,
    upsetOpportunities,
    upsetCorrect,
    mostPickedTeam,
    mostPickedCount,
    mySeasonRank,
    myWeeklyRank,
    totalPlayers,
    leagueAvgPct,
    vsLeagueDelta,
    rolling4Pct,
    rolling4Weeks: last4Weeks.length,
    mostRecentWeekLabel: confirmedWeeks[0].label,
  });
}
