import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// GET /api/admin/seasons
// Returns all seasons with week counts and per-week game counts.
export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [seasons, eligibleUsersCount] = await Promise.all([
    prisma.season.findMany({
      orderBy: [{ year: "desc" }, { type: "asc" }],
      select: {
        id: true, year: true, type: true, mode: true,
        isCurrent: true, timedAutolocking: true, ruleFavouriteTeamBonusWin: true,
        ruleLMS: true, ruleLMSRound: true, usesDivisions: true, createdAt: true,
        parentSeasonId: true,
        parentSeason: { select: { id: true, year: true, type: true } },
        _count: { select: { weeks: true } },
        weeks: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            label: true,
            isCurrent: true,
            lockedForSubmission: true,
            confirmedAt: true,
            _count: {
              select: {
                games: true,
                pickSets: { where: { user: { showOnLeaderboard: true } } },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { showOnLeaderboard: true } }),
  ]);

  // ── LMS per-week stats ────────────────────────────────────────────────────
  // For seasons with ruleLMS, compute cumulative remaining/total after each week.
  const lmsSeasonIds = seasons.filter((s) => s.ruleLMS).map((s) => s.id);
  const lmsStatsByWeek = new Map<string, { remaining: number; total: number }>();

  if (lmsSeasonIds.length > 0) {
    // Build a per-season current round map so we only count the current round's picks
    const seasonRoundMap = new Map(
      seasons.filter((s) => s.ruleLMS).map((s) => [s.id, s.ruleLMSRound])
    );

    // Fetch picks for all LMS seasons but we'll filter to current round per season below
    const allLmsPicks = await prisma.lmsPick.findMany({
      where: { seasonId: { in: lmsSeasonIds } },
      select: { seasonId: true, weekId: true, userId: true, eliminated: true, lmsRound: true },
      orderBy: { week: { number: "asc" } },
    });

    // Build week number index per season
    const weekNumberMap = new Map<string, number>();
    for (const s of seasons) {
      for (const w of s.weeks) weekNumberMap.set(w.id, w.number);
    }

    // Group picks by season, then sort by week number
    const picksBySeason = new Map<string, typeof allLmsPicks>();
    for (const pick of allLmsPicks) {
      if (!picksBySeason.has(pick.seasonId)) picksBySeason.set(pick.seasonId, []);
      picksBySeason.get(pick.seasonId)!.push(pick);
    }

    for (const season of seasons) {
      if (!season.ruleLMS) continue;
      const currentRound = seasonRoundMap.get(season.id) ?? 1;
      // Only count picks from the current round for the running counter
      const picks = (picksBySeason.get(season.id) ?? []).filter(
        (p) => p.lmsRound === currentRound
      );

      // Group by weekId
      const picksByWeek = new Map<string, typeof picks>();
      for (const pick of picks) {
        if (!picksByWeek.has(pick.weekId)) picksByWeek.set(pick.weekId, []);
        picksByWeek.get(pick.weekId)!.push(pick);
      }

      // Process weeks in order tracking cumulative eliminations.
      // Total is always eligibleUsersCount (all showOnLeaderboard users).
      const eliminated = new Set<string>();

      const weeksInOrder = [...season.weeks].sort((a, b) => a.number - b.number);
      for (const week of weeksInOrder) {
        // Only produce a stat if this week is confirmed (has LmsPick records written by confirm-week)
        const weekPicks = picksByWeek.get(week.id) ?? [];
        for (const pick of weekPicks) {
          if (pick.eliminated) eliminated.add(pick.userId);
        }
        if (weekPicks.length > 0) {
          lmsStatsByWeek.set(week.id, {
            total: eligibleUsersCount,
            remaining: Math.max(0, eligibleUsersCount - eliminated.size),
          });
        }
      }
    }
  }

  // Attach lmsStats to each week
  const seasonsWithLms = seasons.map((s) => ({
    ...s,
    weeks: s.weeks.map((w) => ({
      ...w,
      lmsStats: lmsStatsByWeek.get(w.id) ?? null,
    })),
  }));

  return NextResponse.json({ seasons: seasonsWithLms, eligibleUsersCount });
}

// POST /api/admin/seasons
// Creates a new season. Regular seasons get 18 weeks auto-created.
export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    year: number;
    type: "regular" | "postseason";
    mode: "live" | "test";
    parentSeasonId?: string;
  };

  const { year, type, mode, parentSeasonId } = body;

  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (type !== "regular" && type !== "postseason") {
    return NextResponse.json({ error: "type must be 'regular' or 'postseason'" }, { status: 400 });
  }
  if (mode !== "live" && mode !== "test") {
    return NextResponse.json({ error: "mode must be 'live' or 'test'" }, { status: 400 });
  }
  if (type === "postseason" && !parentSeasonId) {
    return NextResponse.json({ error: "parentSeasonId required for postseason" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.season.findUnique({ where: { year_type: { year, type } } });
  if (existing) {
    return NextResponse.json(
      { error: `A ${type} season for ${year} already exists` },
      { status: 409 }
    );
  }

  // Validate parent season exists
  if (parentSeasonId) {
    const parent = await prisma.season.findUnique({ where: { id: parentSeasonId } });
    if (!parent) {
      return NextResponse.json({ error: "Parent season not found" }, { status: 400 });
    }
  }

  // Build week data for regular seasons
  const weekData = type === "regular"
    ? Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        label: `Week ${i + 1}`,
      }))
    : [];

  const season = await prisma.$transaction(async (tx) => {
    const s = await tx.season.create({
      data: {
        year,
        type,
        mode,
        parentSeasonId: parentSeasonId ?? null,
        isCurrent: false,
        weeks: {
          create: weekData,
        },
      },
      include: {
        weeks: { orderBy: { number: "asc" }, select: { id: true, number: true, label: true } },
        parentSeason: { select: { id: true, year: true, type: true } },
      },
    });
    return s;
  });

  return NextResponse.json({ season }, { status: 201 });
}
