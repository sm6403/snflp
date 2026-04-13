import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await params;
  const body = await request.json() as { winnerId: string | null; isTie?: boolean };

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // A game is a tie when isTie=true (winnerId must be null)
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

  return NextResponse.json({ game: updatedGame });
}
