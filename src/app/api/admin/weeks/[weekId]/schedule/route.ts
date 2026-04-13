import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

interface GameInput {
  homeTeamId: string;
  awayTeamId: string;
  gameTime?: string | null;
}

// PUT /api/admin/weeks/[weekId]/schedule
// Replaces all games for a week. Also upserts TeamRecord rows (0-0-0) for each team if missing.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = await params;
  const body = await request.json() as { games: GameInput[] };

  if (!Array.isArray(body.games)) {
    return NextResponse.json({ error: "games must be an array" }, { status: 400 });
  }
  if (body.games.length > 16) {
    return NextResponse.json({ error: "Maximum 16 games per week" }, { status: 400 });
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { id: true, confirmedAt: true },
  });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  if (week.confirmedAt) {
    return NextResponse.json(
      { error: "Cannot edit the schedule for a confirmed week" },
      { status: 409 }
    );
  }

  // Validate all team IDs exist
  const teamIds = body.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]);
  const uniqueTeamIds = [...new Set(teamIds)];
  if (uniqueTeamIds.length > 0) {
    const foundTeams = await prisma.team.findMany({
      where: { id: { in: uniqueTeamIds } },
      select: { id: true },
    });
    if (foundTeams.length !== uniqueTeamIds.length) {
      return NextResponse.json({ error: "One or more team IDs are invalid" }, { status: 400 });
    }
  }

  // Delete existing picks + games, then create new games atomically.
  // TeamRecord upserts run outside the transaction to avoid timeout on Neon
  // (16 sequential round-trips can exceed the 5 s interactive transaction limit).
  const createdGames = await prisma.$transaction(
    async (tx) => {
      const existingGames = await tx.game.findMany({
        where: { weekId },
        select: { id: true },
      });
      if (existingGames.length > 0) {
        await tx.pick.deleteMany({ where: { gameId: { in: existingGames.map((g) => g.id) } } });
        await tx.game.deleteMany({ where: { weekId } });
      }

      // Create new games sequentially (PrismaPg adapter requires sequential ops in a transaction)
      const games = [];
      for (const g of body.games) {
        const created = await tx.game.create({
          data: {
            weekId,
            homeTeamId: g.homeTeamId,
            awayTeamId: g.awayTeamId,
            gameTime: g.gameTime ? new Date(g.gameTime) : null,
          },
          include: {
            homeTeam: { select: { id: true, name: true, abbreviation: true, espnId: true } },
            awayTeam: { select: { id: true, name: true, abbreviation: true, espnId: true } },
          },
        });
        games.push(created);
      }

      return games;
    },
    { timeout: 30_000 } // 30 s — accommodates up to 16 sequential Neon round-trips
  );

  // Upsert TeamRecord (0-0-0) for each team outside the transaction to avoid timeout
  for (const teamId of uniqueTeamIds) {
    await prisma.teamRecord.upsert({
      where: { teamId_weekId: { teamId, weekId } },
      update: {},
      create: { teamId, weekId, wins: 0, losses: 0, ties: 0 },
    });
  }

  return NextResponse.json({ games: createdGames });
}
