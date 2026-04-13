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
  const body = await request.json() as { winnerId: string | null };

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // If setting a winner, validate it's one of the two teams
  if (body.winnerId !== null) {
    if (body.winnerId !== game.homeTeamId && body.winnerId !== game.awayTeamId) {
      return NextResponse.json({ error: "Invalid winner team for this game" }, { status: 400 });
    }
  }

  // Only update the winner — picks are graded in bulk by POST /api/admin/confirm-week
  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: { winnerId: body.winnerId },
    include: { homeTeam: true, awayTeam: true, winner: true },
  });

  return NextResponse.json({ game: updatedGame });
}
