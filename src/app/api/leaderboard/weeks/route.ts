import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { resolveUserLeagueId, getAdminLeagueId } from "@/lib/league-context";

// GET /api/leaderboard/weeks
// Returns confirmed weeks for the current season (for the weekly leaderboard dropdown).
// Most recent week first.
export async function GET() {
  const session = await auth();
  const adminSession = !session?.user?.id ? await getAdminSession() : null;
  const isAdmin = !!adminSession;
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = session?.user?.id
    ? await resolveUserLeagueId(session.user.id)
    : await getAdminLeagueId(adminSession);
  if (!leagueId) {
    return NextResponse.json({ weeks: [] });
  }
  const season = await prisma.season.findFirst({ where: { isCurrent: true, leagueId } });
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
