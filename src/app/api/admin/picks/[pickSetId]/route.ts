import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pickSetId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pickSetId } = await params;
  const body = await request.json() as {
    action: "unlock" | "lock" | "editPick";
    pickId?: string;
    pickedTeamId?: string;
  };

  const pickSet = await prisma.pickSet.findUnique({ where: { id: pickSetId } });
  if (!pickSet) {
    return NextResponse.json({ error: "Pick set not found" }, { status: 404 });
  }

  if (body.action === "unlock") {
    const updated = await prisma.pickSet.update({
      where: { id: pickSetId },
      data: { lockedAt: null, lockedBy: null },
    });
    return NextResponse.json({ pickSet: updated });
  }

  if (body.action === "lock") {
    const updated = await prisma.pickSet.update({
      where: { id: pickSetId },
      data: { lockedAt: new Date(), lockedBy: "admin" },
    });
    return NextResponse.json({ pickSet: updated });
  }

  if (body.action === "editPick") {
    if (!body.pickId || !body.pickedTeamId) {
      return NextResponse.json({ error: "pickId and pickedTeamId required" }, { status: 400 });
    }

    const pick = await prisma.pick.findUnique({ where: { id: body.pickId } });
    if (!pick || pick.pickSetId !== pickSetId) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    // Validate the picked team is in the game
    const game = await prisma.game.findUnique({ where: { id: pick.gameId } });
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (body.pickedTeamId !== game.homeTeamId && body.pickedTeamId !== game.awayTeamId) {
      return NextResponse.json({ error: "Invalid team for this game" }, { status: 400 });
    }

    const updated = await prisma.pick.update({
      where: { id: body.pickId },
      data: { pickedTeamId: body.pickedTeamId, editedBy: "admin" },
      include: { pickedTeam: true },
    });
    return NextResponse.json({ pick: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
