import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.userLeague.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
    select: {
      leagueId: true,
      joinedAt: true,
      league: { select: { name: true } },
    },
  });

  const leagues = memberships.map((m) => ({
    id: m.leagueId,
    name: m.league.name,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return NextResponse.json({ leagues });
}
