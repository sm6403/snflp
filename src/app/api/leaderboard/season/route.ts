import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard/season
// Returns all users ranked by season stats for the current season.
// Only picks from confirmed weeks (confirmedAt IS NOT NULL) are counted.
// positionChange compares current ranking vs ranking without the most-recently-confirmed week.
export async function GET() {
  const session = await auth();
  const isAdmin = !session?.user?.id && (await verifyAdminSession());
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session?.user?.id ?? "";

  const season = await prisma.season.findFirst({
    where: { isCurrent: true },
    select: { id: true, year: true, usesDivisions: true },
  });
  if (!season) {
    return NextResponse.json({ season: null, users: [], mostRecentWeekLabel: null, currentUserId });
  }

  // All confirmed weeks for this season, most recent first
  const confirmedWeeks = await prisma.week.findMany({
    where: { seasonId: season.id, confirmedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { id: true, number: true, label: true, confirmedAt: true },
  });

  if (confirmedWeeks.length === 0) {
    return NextResponse.json({
      season: { id: season.id, year: season.year, usesDivisions: season.usesDivisions },
      mostRecentWeekLabel: null,
      currentUserId,
      users: [],
    });
  }

  const mostRecentWeek = confirmedWeeks[0];
  const allConfirmedWeekIds = confirmedWeeks.map((w) => w.id);
  const previousWeekIds = allConfirmedWeekIds.slice(1); // all except most recent

  // Fetch all users who are active and visible on the leaderboard
  const users = await prisma.user.findMany({
    where: { disabled: false, showOnLeaderboard: true },
    select: { id: true, name: true, alias: true, email: true, favoriteTeam: true },
  });

  // Division data (only when season uses divisions)
  let divisionMap = new Map<string, string>(); // userId → divisionName
  let defaultDivisionName = "SNFLP Division";
  if (season.usesDivisions) {
    const divisions = await prisma.division.findMany({
      where: { seasonId: season.id },
      select: { id: true, name: true, isDefault: true },
    });
    const defaultDiv = divisions.find((d) => d.isDefault);
    if (defaultDiv) defaultDivisionName = defaultDiv.name;
    const divById = new Map(divisions.map((d) => [d.id, d.name]));
    const memberships = await prisma.userDivision.findMany({
      where: { seasonId: season.id },
      select: { userId: true, divisionId: true },
    });
    for (const m of memberships) {
      const name = divById.get(m.divisionId);
      if (name) divisionMap.set(m.userId, name);
    }
  }

  // Fetch all pick sets across confirmed weeks for all users
  const pickSets = await prisma.pickSet.findMany({
    where: { weekId: { in: allConfirmedWeekIds } },
    select: {
      userId: true,
      weekId: true,
      picks: { select: { isCorrect: true } },
    },
  });

  // Aggregate scores per user
  function computeScores(
    sets: typeof pickSets,
    weekFilter: Set<string>
  ): Map<string, { correct: number; graded: number }> {
    const map = new Map<string, { correct: number; graded: number }>();
    for (const ps of sets) {
      if (!weekFilter.has(ps.weekId)) continue;
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

  const allWeeksSet = new Set(allConfirmedWeekIds);
  const prevWeeksSet = new Set(previousWeekIds);

  const currentScores = computeScores(pickSets, allWeeksSet);
  const previousScores = computeScores(pickSets, prevWeeksSet);

  function rankUsers(
    scores: Map<string, { correct: number; graded: number }>,
    allUsers: typeof users
  ): Map<string, number> {
    const sorted = allUsers
      .map((u) => {
        const s = scores.get(u.id) ?? { correct: 0, graded: 0 };
        const pct = s.graded > 0 ? s.correct / s.graded : 0;
        const displayName = u.alias ?? u.name ?? u.email;
        return { userId: u.id, correct: s.correct, graded: s.graded, pct, displayName };
      })
      .sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        if (b.pct !== a.pct) return b.pct - a.pct;
        return a.displayName.localeCompare(b.displayName);
      });

    const rankMap = new Map<string, number>();
    sorted.forEach((u, idx) => rankMap.set(u.userId, idx + 1));
    return rankMap;
  }

  const currentRanks = rankUsers(currentScores, users);
  const previousRanks = previousWeekIds.length > 0 ? rankUsers(previousScores, users) : null;

  const result = users
    .map((u) => {
      const s = currentScores.get(u.id) ?? { correct: 0, graded: 0 };
      const pct = s.graded > 0 ? Math.round((s.correct / s.graded) * 100) : 0;
      const rank = currentRanks.get(u.id) ?? users.length;
      const prevRank = previousRanks?.get(u.id) ?? null;
      const positionChange = prevRank !== null ? prevRank - rank : null;
      const displayName = u.alias ?? u.name ?? u.email;
      const divisionName = season.usesDivisions
        ? (divisionMap.get(u.id) ?? defaultDivisionName)
        : null;
      return {
        userId: u.id,
        displayName,
        favoriteTeam: u.favoriteTeam,
        rank,
        correct: s.correct,
        graded: s.graded,
        pct,
        positionChange,
        divisionName,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return NextResponse.json({
    season: { id: season.id, year: season.year, usesDivisions: season.usesDivisions },
    mostRecentWeekLabel: mostRecentWeek.label,
    currentUserId,
    users: result,
  });
}
