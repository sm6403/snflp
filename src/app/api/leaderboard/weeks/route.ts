import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard/weeks
// Returns confirmed weeks for the current season (for the weekly leaderboard dropdown).
// Most recent week first.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) {
    return NextResponse.json({ weeks: [] });
  }

  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id, confirmedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { id: true, number: true, label: true, confirmedAt: true },
  });

  return NextResponse.json({ weeks });
}
