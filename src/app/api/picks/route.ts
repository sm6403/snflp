import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getGamesForWeek } from "@/lib/nfl-data";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekIdParam = searchParams.get("weekId");
  const userIdParam = searchParams.get("userId");

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
    return NextResponse.json({ error: "No active week found" }, { status: 404 });
  }

  // Server-side auto-lock: if lockAt has passed and week isn't locked yet, lock it now
  if (week.lockAt && !week.lockedForSubmission && new Date(week.lockAt) <= new Date()) {
    week = await prisma.week.update({
      where: { id: week.id },
      data: { lockedForSubmission: true },
      include: { season: true },
    });
  }

  // Determine which user's picks to return
  const isViewingOther =
    !!userIdParam &&
    userIdParam !== session.user.id;

  // Viewing another user's picks is only allowed for confirmed weeks
  if (isViewingOther && !week.confirmedAt) {
    return NextResponse.json(
      { error: "Results have not been confirmed for this week yet" },
      { status: 403 }
    );
  }

  const targetUserId = isViewingOther ? userIdParam! : session.user.id;

  const games = await getGamesForWeek(week.id);

  // Determine season-level flags
  const season = await prisma.season.findUnique({
    where: { id: week.seasonId },
    select: { timedAutolocking: true, ruleFavouriteTeamBonusWin: true },
  });
  const timedAutolocking = season?.timedAutolocking ?? false;
  const ruleFavouriteTeamBonusWin = season?.ruleFavouriteTeamBonusWin ?? false;

  // Compute per-game isTimeLocked: locked when gameTime ≤ 1 min from now
  const now = new Date();
  const gamesForResponse = week.confirmedAt
    ? games
    : games.map((g) => ({
        ...g,
        winner: null,
        winnerId: null,
        isTimeLocked: timedAutolocking
          ? g.gameTime != null && new Date(g.gameTime).getTime() - now.getTime() < 60_000
          : false,
      }));

  const pickSet = await prisma.pickSet.findUnique({
    where: { userId_weekId: { userId: targetUserId, weekId: week.id } },
    include: {
      picks: {
        include: { pickedTeam: true, game: true },
      },
    },
  });

  // Resolve favourite team ID for whoever's picks are being shown
  // (needed for the bonus win highlight when viewing another user's results)
  let favoriteTeamId: string | null = null;
  {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { favoriteTeam: true },
    });
    if (user?.favoriteTeam) {
      const team = await prisma.team.findFirst({
        where: { name: user.favoriteTeam },
        select: { id: true },
      });
      favoriteTeamId = team?.id ?? null;
    }
  }

  // When viewing another user, include their display name for the page title
  let viewingUser: { alias: string | null; name: string | null } | null = null;
  if (isViewingOther) {
    viewingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { alias: true, name: true },
    });
  }

  // ── Recent form (last ≤3 confirmed weeks before this one) ──────────────────
  const recentConfirmedWeeks = await prisma.week.findMany({
    where: {
      seasonId: week.seasonId,
      number: { lt: week.number },
      confirmedAt: { not: null },
    },
    orderBy: { number: "desc" },
    take: 3,
    include: {
      games: {
        select: {
          homeTeamId: true,
          awayTeamId: true,
          winnerId: true,
          isTie: true,
          homeTeam: { select: { espnId: true, abbreviation: true } },
          awayTeam: { select: { espnId: true, abbreviation: true } },
        },
      },
    },
  });

  type FormEntry = {
    result: "win" | "loss" | "tie" | "bye";
    weekNumber: number;
    opponentEspnId?: string;
    opponentAbbr?: string;
  };

  const currentTeamIds = new Set<string>();
  for (const g of games) {
    currentTeamIds.add(g.homeTeam.id);
    currentTeamIds.add(g.awayTeam.id);
  }

  const teamForm: Record<string, FormEntry[]> = {};
  for (const teamId of currentTeamIds) {
    teamForm[teamId] = recentConfirmedWeeks.map((rw) => {
      const game = rw.games.find(
        (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
      );
      if (!game) return { result: "bye" as const, weekNumber: rw.number };
      const isHome = game.homeTeamId === teamId;
      const opponent = isHome ? game.awayTeam : game.homeTeam;
      let result: "win" | "loss" | "tie";
      if (game.isTie) result = "tie";
      else if (game.winnerId === teamId) result = "win";
      else result = "loss";
      return { result, weekNumber: rw.number, opponentEspnId: opponent.espnId, opponentAbbr: opponent.abbreviation };
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    week,
    games: gamesForResponse,
    pickSet,
    favoriteTeamId,
    isViewingOther,
    viewingUser,
    timedAutolocking,
    ruleFavouriteTeamBonusWin,
    teamForm,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { picks } = await request.json() as {
    picks: Array<{ gameId: string; pickedTeamId: string }>;
  };

  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "No picks provided" }, { status: 400 });
  }

  const week = await getCurrentWeek();
  if (!week) {
    return NextResponse.json({ error: "No active week found" }, { status: 404 });
  }

  // Check if the week is locked for new submissions
  if (week.lockedForSubmission) {
    return NextResponse.json(
      { error: "This week is locked — no new submissions accepted." },
      { status: 409 }
    );
  }

  // Check for existing locked pick set
  const existingPickSet = await prisma.pickSet.findUnique({
    where: { userId_weekId: { userId: session.user.id, weekId: week.id } },
  });
  if (existingPickSet?.lockedAt) {
    return NextResponse.json({ error: "Picks are locked" }, { status: 409 });
  }

  // Fetch season to check timed autolocking
  const weekSeason = await prisma.season.findUnique({
    where: { id: week.seasonId },
    select: { timedAutolocking: true },
  });
  const timedAutolock = weekSeason?.timedAutolocking ?? false;

  // Validate: one pick per game, and picked team must be in that game
  const games = await getGamesForWeek(week.id);
  const postNow = new Date();

  // Determine which games are time-locked
  const timeLockedGameIds = timedAutolock
    ? new Set(
        games
          .filter((g) => g.gameTime != null && new Date(g.gameTime).getTime() - postNow.getTime() < 60_000)
          .map((g) => g.id)
      )
    : new Set<string>();

  const pickableGames = games.filter((g) => !timeLockedGameIds.has(g.id));

  // When timed autolocking: only require picks for non-locked games
  if (!timedAutolock && picks.length !== games.length) {
    return NextResponse.json(
      { error: `Expected ${games.length} picks, got ${picks.length}` },
      { status: 400 }
    );
  }

  const gameMap = new Map(games.map((g) => [g.id, g]));
  for (const pick of picks) {
    const game = gameMap.get(pick.gameId);
    if (!game) {
      return NextResponse.json({ error: `Unknown game: ${pick.gameId}` }, { status: 400 });
    }
    if (timeLockedGameIds.has(pick.gameId)) {
      return NextResponse.json(
        { error: `Game ${pick.gameId} is time-locked and cannot be changed` },
        { status: 400 }
      );
    }
    if (pick.pickedTeamId !== game.homeTeamId && pick.pickedTeamId !== game.awayTeamId) {
      return NextResponse.json(
        { error: `Invalid team for game ${pick.gameId}` },
        { status: 400 }
      );
    }
  }

  // When timed autolocking, require picks for all non-locked games
  if (timedAutolock && picks.length !== pickableGames.length) {
    return NextResponse.json(
      { error: `Expected ${pickableGames.length} picks (excluding ${timeLockedGameIds.size} locked games), got ${picks.length}` },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const weekId = week.id;

  const pickSet = await prisma.$transaction(async (tx) => {
    const ps = await tx.pickSet.upsert({
      where: { userId_weekId: { userId, weekId } },
      create: { userId, weekId, submittedAt: postNow, lockedAt: postNow, lockedBy: "user" },
      update: { submittedAt: postNow, lockedAt: postNow, lockedBy: "user" },
    });

    // Delete only non-time-locked picks (preserve existing picks for locked games)
    await tx.pick.deleteMany({
      where: {
        pickSetId: ps.id,
        gameId: { notIn: [...timeLockedGameIds] },
      },
    });

    // Insert picks for non-locked games
    await tx.pick.createMany({
      data: picks.map((p) => ({
        pickSetId: ps.id,
        gameId: p.gameId,
        pickedTeamId: p.pickedTeamId,
      })),
    });

    // If timed autolocking: insert null picks for locked games not yet recorded
    if (timedAutolock && timeLockedGameIds.size > 0) {
      const existingLockedPicks = await tx.pick.findMany({
        where: { pickSetId: ps.id, gameId: { in: [...timeLockedGameIds] } },
        select: { gameId: true },
      });
      const existingLockedGameIds = new Set(existingLockedPicks.map((p) => p.gameId));
      const missingLockedGames = [...timeLockedGameIds].filter((id) => !existingLockedGameIds.has(id));
      if (missingLockedGames.length > 0) {
        await tx.pick.createMany({
          data: missingLockedGames.map((gameId) => ({
            pickSetId: ps.id,
            gameId,
            pickedTeamId: null,
          })),
        });
      }
    }

    return ps;
  });

  return NextResponse.json({ pickSet }, { status: 200 });
}
