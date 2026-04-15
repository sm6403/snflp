import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { getCurrentWeek } from "@/lib/nfl-data";

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekIdParam = searchParams.get("weekId");

  let week;
  if (weekIdParam) {
    week = await prisma.week.findUnique({
      where: { id: weekIdParam },
      include: { season: true },
    });
  } else {
    week = await getCurrentWeek();
  }

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  // Server-side auto-lock: if lockAt has passed and week isn't locked yet, lock it now
  if (week.lockAt && !week.lockedForSubmission && new Date(week.lockAt) <= new Date()) {
    week = await prisma.week.update({
      where: { id: week.id },
      data: { lockedForSubmission: true },
      include: { season: true },
    });
  }

  const [submittedPickSets, eligibleUsers] = await Promise.all([
    prisma.pickSet.findMany({
      where: { weekId: week.id },
      include: {
        user: { select: { id: true, name: true, email: true, alias: true, favoriteTeam: true } },
        picks: {
          include: {
            pickedTeam: true,
            game: { include: { homeTeam: true, awayTeam: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { showOnLeaderboard: true },
      select: { id: true, name: true, email: true, alias: true, favoriteTeam: true },
      orderBy: { alias: "asc" },
    }),
  ]);

  // Build combined list: submitted users first, then eligible users who haven't submitted
  const submittedUserIds = new Set(submittedPickSets.map((ps) => ps.userId));
  const pendingPickSets = eligibleUsers
    .filter((u) => !submittedUserIds.has(u.id))
    .map((u) => ({
      id: `pending-${u.id}`,
      submittedAt: null,
      lockedAt: null,
      lockedBy: null,
      user: u,
      picks: [] as typeof submittedPickSets[0]["picks"],
    }));

  const pickSets = [...submittedPickSets, ...pendingPickSets];

  // Games for the Confirm Results UI
  const games = await prisma.game.findMany({
    where: { weekId: week.id },
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ gameTime: "asc" }, { id: "asc" }],
  });

  // All weeks for the selector dropdown
  const weeks = await prisma.week.findMany({
    orderBy: [{ season: { year: "desc" } }, { number: "asc" }],
    include: { season: { select: { id: true, year: true } } },
  });

  // LMS picks for this week (only when ruleLMS is enabled)
  const ruleLMS = week.season.ruleLMS ?? false;
  const lmsPicksByUserId: Record<string, { teamId: string | null; eliminated: boolean; team: { id: string; name: string; abbreviation: string; espnId: string } | null }> = {};
  let lmsTeams: { id: string; name: string; abbreviation: string; espnId: string }[] = [];
  if (ruleLMS) {
    const [lmsPicks, allTeams] = await Promise.all([
      prisma.lmsPick.findMany({
        where: { weekId: week.id },
        select: { userId: true, teamId: true, eliminated: true, team: { select: { id: true, name: true, abbreviation: true, espnId: true } } },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, abbreviation: true, espnId: true },
        orderBy: { name: "asc" },
      }),
    ]);
    for (const p of lmsPicks) {
      lmsPicksByUserId[p.userId] = { teamId: p.teamId, eliminated: p.eliminated, team: p.team };
    }
    lmsTeams = allTeams;
  }

  return NextResponse.json({ week, pickSets, weeks, games, ruleLMS, lmsPicksByUserId, lmsTeams });
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    action: "lockWeek" | "unlockWeek" | "setLockTime" | "clearLockTime";
    weekId: string;
    lockAt?: string; // ISO string (UTC)
  };

  if (!body.weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  const adminName = await getAdminName() ?? "unknown";

  if (body.action === "lockWeek") {
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockedForSubmission: true },
      include: { season: true },
    });
    await logAdminAction(adminName, "LOCK_WEEK", {
      weekId: week.id,
      weekLabel: week.label,
      seasonYear: week.season.year,
    });
    return NextResponse.json({ week });
  }

  if (body.action === "unlockWeek") {
    // Also clear lockAt so the auto-lock cron doesn't immediately re-lock the week
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockedForSubmission: false, lockAt: null },
      include: { season: true },
    });
    await logAdminAction(adminName, "UNLOCK_WEEK", {
      weekId: week.id,
      weekLabel: week.label,
      seasonYear: week.season.year,
    });
    return NextResponse.json({ week });
  }

  if (body.action === "setLockTime") {
    if (!body.lockAt) {
      return NextResponse.json({ error: "lockAt required" }, { status: 400 });
    }
    const lockAtDate = new Date(body.lockAt);
    if (isNaN(lockAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid lockAt date" }, { status: 400 });
    }
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockAt: lockAtDate },
      include: { season: true },
    });
    await logAdminAction(adminName, "SET_LOCK_TIME", {
      weekId: week.id,
      weekLabel: week.label,
      seasonYear: week.season.year,
      lockAt: body.lockAt,
    });
    return NextResponse.json({ week });
  }

  if (body.action === "clearLockTime") {
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockAt: null },
      include: { season: true },
    });
    await logAdminAction(adminName, "CLEAR_LOCK_TIME", {
      weekId: week.id,
      weekLabel: week.label,
      seasonYear: week.season.year,
    });
    return NextResponse.json({ week });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ─── Submit picks on behalf of a user ────────────────────────────────────────

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    userId: string;
    weekId: string;
    picks: Array<{ gameId: string; pickedTeamId: string }>;
    lmsTeamId?: string;
  };

  const { userId, weekId, picks, lmsTeamId } = body;

  if (!userId || !weekId || !Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "userId, weekId and picks required" }, { status: 400 });
  }

  const [user, week] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, alias: true, email: true },
    }),
    prisma.week.findUnique({
      where: { id: weekId },
      include: { season: true },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const existing = await prisma.pickSet.findUnique({
    where: { userId_weekId: { userId, weekId } },
  });
  if (existing) {
    return NextResponse.json({ error: "User already has picks for this week" }, { status: 409 });
  }

  // Validate each pick references a game in this week with a valid team
  const games = await prisma.game.findMany({
    where: { weekId },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  const gameMap = new Map(games.map((g) => [g.id, g]));

  for (const pick of picks) {
    const game = gameMap.get(pick.gameId);
    if (!game) {
      return NextResponse.json({ error: `Game not found: ${pick.gameId}` }, { status: 400 });
    }
    if (pick.pickedTeamId !== game.homeTeamId && pick.pickedTeamId !== game.awayTeamId) {
      return NextResponse.json({ error: `Invalid team for game ${pick.gameId}` }, { status: 400 });
    }
  }

  const now = new Date();
  const adminName = (await getAdminName()) ?? "unknown";
  const userLabel = user.alias ?? user.name ?? user.email;

  await prisma.$transaction(async (tx) => {
    await tx.pickSet.create({
      data: {
        userId,
        weekId,
        submittedAt: now,
        lockedAt: now,
        lockedBy: "admin",
        picks: {
          create: picks.map((p) => ({
            gameId: p.gameId,
            pickedTeamId: p.pickedTeamId,
            editedBy: "admin",
          })),
        },
      },
    });

    if (lmsTeamId && week.season.ruleLMS) {
      await tx.lmsPick.upsert({
        where: { userId_weekId: { userId, weekId } },
        create: {
          userId,
          weekId,
          seasonId: week.seasonId,
          teamId: lmsTeamId,
          lmsRound: week.season.ruleLMSRound ?? 1,
        },
        update: { teamId: lmsTeamId },
      });
    }
  });

  await logAdminAction(adminName, "ADMIN_SUBMIT_PICKS", {
    user: userLabel,
    weekLabel: week.label,
    seasonYear: week.season.year,
    pickCount: picks.length,
  });

  return NextResponse.json({ ok: true });
}
