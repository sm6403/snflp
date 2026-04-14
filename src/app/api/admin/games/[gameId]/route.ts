import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await params;
  const body = await request.json() as { winnerId: string | null; isTie?: boolean };

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { homeTeam: true, awayTeam: true, week: { include: { season: true } } },
  });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const isTie = body.isTie === true;

  // If setting a winner, validate it's one of the two teams
  if (!isTie && body.winnerId !== null) {
    if (body.winnerId !== game.homeTeamId && body.winnerId !== game.awayTeamId) {
      return NextResponse.json({ error: "Invalid winner team for this game" }, { status: 400 });
    }
  }

  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: {
      winnerId: isTie ? null : body.winnerId,
      isTie,
    },
    include: { homeTeam: true, awayTeam: true, winner: true },
  });

  const adminName = await getAdminName() ?? "unknown";
  const matchup = `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`;
  const result = isTie
    ? "TIE"
    : body.winnerId
    ? (body.winnerId === game.homeTeamId ? game.homeTeam.abbreviation : game.awayTeam.abbreviation) + " won"
    : "cleared";

  await logAdminAction(adminName, "SET_GAME_RESULT", {
    weekLabel: game.week.label,
    seasonYear: game.week.season.year,
    game: matchup,
    result,
  });

  return NextResponse.json({ game: updatedGame });
}
