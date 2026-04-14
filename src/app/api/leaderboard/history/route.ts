import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek } from "@/lib/nfl-data";

// GET /api/leaderboard/history
// Returns the current user's weekly position and cumulative season position
// for each confirmed week this season, in chronological order.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentWeek = await getCurrentWeek();
  if (!currentWeek) {
    return NextResponse.json({ weeks: [] });
  }

  // All confirmed weeks in chronological order
  const confirmedWeeks = await prisma.week.findMany({
    where: { seasonId: currentWeek.seasonId, confirmedAt: { not: null } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, label: true },
  });

  if (confirmedWeeks.length === 0) {
    return NextResponse.json({ weeks: [] });
  }

  const userId = session.user.id;

  // Eligible users (same filter as the live leaderboard)
  const eligibleUsers = await prisma.user.findMany({
    where: { disabled: false, showOnLeaderboard: true },
    select: { id: true },
  });
  const totalPlayers = eligibleUsers.length;
  const eligibleIds = new Set(eligibleUsers.map((u) => u.id));

  // Division context — only when the season uses divisions
  const season = await prisma.season.findUnique({
    where: { id: currentWeek.seasonId },
    select: { usesDivisions: true },
  });
  let divisionName: string | null = null;
  let divisionIds: Set<string> = new Set();
  if (season?.usesDivisions) {
    const divisions = await prisma.division.findMany({
      where: { seasonId: currentWeek.seasonId },
      select: { id: true, name: true, isDefault: true },
    });
    const defaultDiv = divisions.find((d) => d.isDefault);
    const membership = await prisma.userDivision.findUnique({
      where: { userId_seasonId: { userId, seasonId: currentWeek.seasonId } },
      select: { divisionId: true },
    });
    const userDivId = membership?.divisionId ?? defaultDiv?.id;
    if (userDivId) {
      divisionName = divisions.find((d) => d.id === userDivId)?.name ?? null;
      // All users in the same division (explicit + implicitly-default)
      const explicitMembers = await prisma.userDivision.findMany({
        where: { seasonId: currentWeek.seasonId, divisionId: userDivId },
        select: { userId: true },
      });
      const explicitIds = new Set(explicitMembers.map((m) => m.userId));
      // Users with no explicit assignment fall into the default division
      const allMemberIds = userDivId === defaultDiv?.id
        ? [...eligibleUsers.filter((u) => !explicitIds.has(u.id) || explicitIds.has(u.id)).map((u) => {
            // eligible users either: explicitly in this div, or have no assignment at all
            return u;
          })]
        : eligibleUsers.filter((u) => explicitIds.has(u.id));
      // Re-compute: default div = everyone without an explicit assignment + those explicitly assigned
      if (userDivId === defaultDiv?.id) {
        const allExplicitlyAssigned = await prisma.userDivision.findMany({
          where: { seasonId: currentWeek.seasonId },
          select: { userId: true },
        });
        const anyDivIds = new Set(allExplicitlyAssigned.map((m) => m.userId));
        divisionIds = new Set([
          ...eligibleUsers.filter((u) => !anyDivIds.has(u.id)).map((u) => u.id),
          ...explicitIds,
        ]);
      } else {
        divisionIds = explicitIds;
      }
      // Intersect with eligible
      divisionIds = new Set([...divisionIds].filter((id) => eligibleIds.has(id)));
    }
  }

  // All pick sets for confirmed weeks
  const allWeekIds = confirmedWeeks.map((w) => w.id);
  const pickSets = await prisma.pickSet.findMany({
    where: { weekId: { in: allWeekIds } },
    select: {
      userId: true,
      weekId: true,
      picks: { select: { isCorrect: true } },
    },
  });

  // Group by week
  const psByWeek = new Map<string, typeof pickSets>();
  for (const ps of pickSets) {
    if (!psByWeek.has(ps.weekId)) psByWeek.set(ps.weekId, []);
    psByWeek.get(ps.weekId)!.push(ps);
  }

  // Running cumulative totals per user (for season rank at each week)
  const cumCorrect = new Map<string, number>();
  const cumGraded = new Map<string, number>();

  const usesDivisions = season?.usesDivisions ?? false;
  const divisionPlayerCount = divisionIds.size > 0 ? divisionIds.size : null;

  const result: Array<{
    weekNumber: number;
    weekLabel: string;
    weeklyRank: number | null;
    seasonRank: number | null;
    totalPlayers: number;
    weeklyDivisionRank: number | null;
    seasonDivisionRank: number | null;
    divisionPlayerCount: number | null;
  }> = [];

  for (const week of confirmedWeeks) {
    const weekSets = (psByWeek.get(week.id) ?? []).filter((ps) =>
      eligibleIds.has(ps.userId)
    );

    // Update cumulative scores
    for (const ps of weekSets) {
      let c = cumCorrect.get(ps.userId) ?? 0;
      let g = cumGraded.get(ps.userId) ?? 0;
      for (const p of ps.picks) {
        if (p.isCorrect !== null) {
          g++;
          if (p.isCorrect) c++;
        }
      }
      cumCorrect.set(ps.userId, c);
      cumGraded.set(ps.userId, g);
    }

    // ── Weekly rank ───────────────────────────────────────────────────────────
    const weekRanked = weekSets
      .map((ps) => {
        const graded = ps.picks.filter((p) => p.isCorrect !== null);
        const correct = graded.filter((p) => p.isCorrect === true).length;
        const pct = graded.length > 0 ? correct / graded.length : 0;
        return { userId: ps.userId, correct, pct };
      })
      .sort((a, b) =>
        b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
      );

    const weeklyRankIdx = weekRanked.findIndex((u) => u.userId === userId);
    const weeklyRank = weeklyRankIdx >= 0 ? weeklyRankIdx + 1 : null;

    // ── Cumulative season rank at this week ──────────────────────────────────
    const seasonRanked = eligibleUsers
      .map((u) => {
        const correct = cumCorrect.get(u.id) ?? 0;
        const graded = cumGraded.get(u.id) ?? 0;
        const pct = graded > 0 ? correct / graded : 0;
        return { userId: u.id, correct, pct };
      })
      .sort((a, b) =>
        b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
      );

    const seasonRankIdx = seasonRanked.findIndex((u) => u.userId === userId);
    const seasonRank = seasonRankIdx >= 0 ? seasonRankIdx + 1 : null;

    // ── Division-scoped ranks (only when divisions active) ────────────────────
    let weeklyDivisionRank: number | null = null;
    let seasonDivisionRank: number | null = null;

    if (usesDivisions && divisionIds.size > 0) {
      const divWeekSets = weekSets.filter((ps) => divisionIds.has(ps.userId));
      const divWeekRanked = divWeekSets
        .map((ps) => {
          const graded = ps.picks.filter((p) => p.isCorrect !== null);
          const correct = graded.filter((p) => p.isCorrect === true).length;
          const pct = graded.length > 0 ? correct / graded.length : 0;
          return { userId: ps.userId, correct, pct };
        })
        .sort((a, b) =>
          b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
        );
      const divWeekIdx = divWeekRanked.findIndex((u) => u.userId === userId);
      weeklyDivisionRank = divWeekIdx >= 0 ? divWeekIdx + 1 : null;

      const divSeasonRanked = [...divisionIds]
        .map((uid) => {
          const correct = cumCorrect.get(uid) ?? 0;
          const graded = cumGraded.get(uid) ?? 0;
          const pct = graded > 0 ? correct / graded : 0;
          return { userId: uid, correct, pct };
        })
        .sort((a, b) =>
          b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
        );
      const divSeasonIdx = divSeasonRanked.findIndex((u) => u.userId === userId);
      seasonDivisionRank = divSeasonIdx >= 0 ? divSeasonIdx + 1 : null;
    }

    result.push({
      weekNumber: week.number,
      weekLabel: week.label,
      weeklyRank,
      seasonRank,
      totalPlayers,
      weeklyDivisionRank,
      seasonDivisionRank,
      divisionPlayerCount,
    });
  }

  return NextResponse.json({ weeks: result, usesDivisions, divisionName });
}
