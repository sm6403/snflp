import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek } from "@/lib/nfl-data";
import { resolveUserLeagueId, getAdminLeagueId } from "@/lib/league-context";

// GET /api/leaderboard/chart-history
// Returns every eligible user's weekly rank AND cumulative season rank for each
// confirmed week this season — used to power the multi-line position charts.
// Accessible by regular users (session) or admins (admin cookie).
export async function GET() {
  const session = await auth();
  const adminSession = !session?.user?.id ? await getAdminSession() : null;
  const isAdmin = !!adminSession;
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session?.user?.id ?? "";

  const leagueId = session?.user?.id
    ? await resolveUserLeagueId(session.user.id)
    : await getAdminLeagueId(adminSession);
  if (!leagueId) {
    return NextResponse.json({ error: "No league context" }, { status: 400 });
  }
  const currentWeek = await getCurrentWeek(leagueId);
  if (!currentWeek) {
    return NextResponse.json({
      confirmedWeeks: [],
      users: [],
      currentUserId,
      totalPlayers: 0,
    });
  }

  const confirmedWeeks = await prisma.week.findMany({
    where: { seasonId: currentWeek.seasonId, confirmedAt: { not: null } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, label: true },
  });

  if (confirmedWeeks.length === 0) {
    return NextResponse.json({
      confirmedWeeks: [],
      users: [],
      currentUserId,
      totalPlayers: 0,
    });
  }

  const eligibleUsers = await prisma.user.findMany({
    where: { disabled: false, showOnLeaderboard: true, userLeagues: { some: { leagueId } } },
    select: { id: true, name: true, alias: true, email: true },
  });
  const totalPlayers = eligibleUsers.length;
  const eligibleIds = new Set(eligibleUsers.map((u) => u.id));

  const allWeekIds = confirmedWeeks.map((w) => w.id);
  const pickSets = await prisma.pickSet.findMany({
    where: { weekId: { in: allWeekIds } },
    select: {
      userId: true,
      weekId: true,
      picks: { select: { isCorrect: true } },
    },
  });

  // Group pick sets by weekId
  const psByWeek = new Map<string, typeof pickSets>();
  for (const ps of pickSets) {
    if (!psByWeek.has(ps.weekId)) psByWeek.set(ps.weekId, []);
    psByWeek.get(ps.weekId)!.push(ps);
  }

  // Per-user running cumulative totals
  const cumCorrect = new Map<string, number>();
  const cumGraded = new Map<string, number>();

  // Initialize per-user history entries
  type UserHistory = {
    userId: string;
    displayName: string;
    weeklyRanks: (number | null)[];
    seasonRanks: (number | null)[];
  };
  const historyMap = new Map<string, UserHistory>();
  for (const u of eligibleUsers) {
    historyMap.set(u.id, {
      userId: u.id,
      displayName: u.alias ?? u.name ?? u.email,
      weeklyRanks: [],
      seasonRanks: [],
    });
  }

  for (const week of confirmedWeeks) {
    const weekSets = (psByWeek.get(week.id) ?? []).filter((ps) =>
      eligibleIds.has(ps.userId)
    );

    // Update cumulative totals
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

    // ── Weekly rank (this week only) ─────────────────────────────────────────
    const weeklyRankMap = new Map<string, number>();
    weekSets
      .map((ps) => {
        const graded = ps.picks.filter((p) => p.isCorrect !== null);
        const correct = graded.filter((p) => p.isCorrect === true).length;
        const pct = graded.length > 0 ? correct / graded.length : 0;
        return { userId: ps.userId, correct, pct };
      })
      .sort((a, b) =>
        b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
      )
      .forEach((u, idx) => weeklyRankMap.set(u.userId, idx + 1));

    // ── Season rank (cumulative through this week) ────────────────────────────
    const seasonRankMap = new Map<string, number>();
    eligibleUsers
      .map((u) => {
        const correct = cumCorrect.get(u.id) ?? 0;
        const graded = cumGraded.get(u.id) ?? 0;
        const pct = graded > 0 ? correct / graded : 0;
        return { userId: u.id, correct, pct };
      })
      .sort((a, b) =>
        b.correct !== a.correct ? b.correct - a.correct : b.pct - a.pct
      )
      .forEach((u, idx) => seasonRankMap.set(u.userId, idx + 1));

    // Append this week's ranks to each user's history
    for (const [uid, history] of historyMap) {
      history.weeklyRanks.push(weeklyRankMap.get(uid) ?? null);
      history.seasonRanks.push(seasonRankMap.get(uid) ?? null);
    }
  }

  return NextResponse.json({
    confirmedWeeks: confirmedWeeks.map((w) => ({
      weekId: w.id,
      weekNumber: w.number,
      weekLabel: w.label,
    })),
    users: [...historyMap.values()],
    currentUserId,
    totalPlayers,
  });
}
