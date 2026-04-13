import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek, getGamesForWeek } from "@/lib/nfl-data";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const week = await getCurrentWeek();
  if (!week) {
    return NextResponse.json({ error: "No active week found" }, { status: 404 });
  }

  const games = await getGamesForWeek(week.id);

  const pickSet = await prisma.pickSet.findUnique({
    where: { userId_weekId: { userId: session.user.id, weekId: week.id } },
    include: {
      picks: {
        include: { pickedTeam: true, game: true },
      },
    },
  });

  return NextResponse.json({ week, games, pickSet });
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
