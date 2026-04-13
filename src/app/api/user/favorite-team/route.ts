import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NFL_TEAMS } from "@/lib/nfl-teams";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { team } = await request.json();

  if (!team || !NFL_TEAMS.includes(team)) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { favoriteTeam: team },
  });

  return NextResponse.json({ team });
}
