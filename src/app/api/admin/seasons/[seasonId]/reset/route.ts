import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ seasonId: string }> };

// POST /api/admin/seasons/[seasonId]/reset
// Deletes all picks + pick sets for every week in the season, clears all game winners,
// unlocks every week, clears confirmedAt, and resets isCurrent to Week 1.
export async function POST(_request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { seasonId } = await params;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { weeks: { orderBy: { number: "asc" }, select: { id: true, number: true } } },
  });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const weekIds = season.weeks.map((w) => w.id);

  await prisma.$transaction(async (tx) => {
    if (weekIds.length > 0) {
      // 1. Delete all picks for pick sets in these weeks
      await tx.pick.deleteMany({ where: { pickSet: { weekId: { in: weekIds } } } });

      // 2. Delete all pick sets for these weeks
      await tx.pickSet.deleteMany({ where: { weekId: { in: weekIds } } });

      // 3. Clear all game winners for these weeks
      await tx.game.updateMany({
        where: { weekId: { in: weekIds } },
        data: { winnerId: null },
      });

      // 4. Unlock all weeks and clear confirmation timestamps
      await tx.week.updateMany({
        where: { id: { in: weekIds } },
        data: { lockedForSubmission: false, confirmedAt: null, isCurrent: false },
      });

      // 5. Set Week 1 (lowest number) as current
      const firstWeek = season.weeks[0];
      if (firstWeek) {
        await tx.week.update({
          where: { id: firstWeek.id },
          data: { isCurrent: true },
        });
        // Keep LeagueSettings in sync so both live and test modes see Week 1
        await tx.leagueSettings.upsert({
          where: { leagueId: season.leagueId },
          create: { leagueId: season.leagueId, mode: "live", testSeasonId: seasonId, testWeekId: firstWeek.id },
          update: { testSeasonId: seasonId, testWeekId: firstWeek.id },
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}
