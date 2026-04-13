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

  // Mask winners from users until the week is officially confirmed
  const gamesForResponse = week.confirmedAt
    ? games
    : games.map((g) => ({ ...g, winner: null, winnerId: null }));

  const pickSet = await prisma.pickSet.findUnique({
    where: { userId_weekId: { userId: targetUserId, weekId: week.id } },
    include: {
      picks: {
        include: { pickedTeam: true, game: true },
      },
    },
  });

  // Resolve favourite team ID only for the current user's own picks
  let favoriteTeamId: string | null = null;
  if (!isViewingOther) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

  return NextResponse.json({
    week,
    games: gamesForResponse,
    pickSet,
    favoriteTeamId,
    isViewingOther,
    viewingUser,
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

  // Validate: one pick per game, and picked team must be in that game
  const games = await getGamesForWeek(week.id);
  if (picks.length !== games.length) {
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
    if (pick.pickedTeamId !== game.homeTeamId && pick.pickedTeamId !== game.awayTeamId) {
      return NextResponse.json(
        { error: `Invalid team for game ${pick.gameId}` },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  const userId = session.user.id;
  const weekId = week.id;

  const pickSet = await prisma.$transaction(async (tx) => {
    const ps = await tx.pickSet.upsert({
      where: { userId_weekId: { userId, weekId } },
      create: { userId, weekId, submittedAt: now, lockedAt: now, lockedBy: "user" },
      update: { submittedAt: now, lockedAt: now, lockedBy: "user" },
    });

    await tx.pick.deleteMany({ where: { pickSetId: ps.id } });
    await tx.pick.createMany({
      data: picks.map((p) => ({
        pickSetId: ps.id,
        gameId: p.gameId,
        pickedTeamId: p.pickedTeamId,
      })),
    });

    return ps;
  });

  return NextResponse.json({ pickSet }, { status: 200 });
}
