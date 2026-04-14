import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NFL_TEAMS } from "@/lib/nfl-teams";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Users can only lock their own pick — unlocking is admin-only
  if (typeof body.locked === "boolean") {
    if (body.locked === false) {
      return NextResponse.json(
        { error: "Only an admin can unlock your favourite team pick." },
        { status: 403 }
      );
    }
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { favoriteTeamLocked: true },
      select: { favoriteTeam: true, favoriteTeamLocked: true },
    });
    return NextResponse.json(user);
  }

  // Change team — blocked when locked
  if (body.team !== undefined) {
    if (!NFL_TEAMS.includes(body.team)) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favoriteTeamLocked: true },
    });
    if (current?.favoriteTeamLocked) {
      return NextResponse.json(
        { error: "Your favourite team pick is locked. Unlock it first to make changes." },
        { status: 403 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { favoriteTeam: body.team },
      select: { favoriteTeam: true, favoriteTeamLocked: true },
    });
    return NextResponse.json(user);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
