import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWeek } from "@/lib/nfl-data";

// GET /api/picks/season
// Returns all weeks of the current season with the user's pick scores per week.
// Scores are only included for weeks where confirmedAt IS NOT NULL.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) {
    return NextResponse.json({ season: null, weeks: [], currentWeekId: null });
  }

  // Resolve the actual "current" week (respects test mode vs live mode)
  const currentWeek = await getCurrentWeek();
  const currentWeekId = currentWeek?.id ?? null;

  // Fetch all weeks for this season, ordered 1→18
  const dbWeeks = await prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      label: true,
      lockedForSubmission: true,
      confirmedAt: true,
    },
  });

  // Fetch all pick sets for this user for any week in this season
  const weekIds = dbWeeks.map((w) => w.id);
  const pickSets = await prisma.pickSet.findMany({
    where: {
      userId: session.user.id,
      weekId: { in: weekIds },
    },
    select: {
      weekId: true,
      picks: {
        select: { isCorrect: true },
      },
    },
  });
  const pickSetByWeekId = Object.fromEntries(pickSets.map((ps) => [ps.weekId, ps]));

  // Build a 1-18 week list — slots without DB data are placeholders
  const weekSlots = Array.from({ length: 18 }, (_, i) => {
    const num = i + 1;
    const dbWeek = dbWeeks.find((w) => w.number === num);
    if (!dbWeek) {
      return {
        id: null,
        number: num,
        label: `Week ${num}`,
        lockedForSubmission: false,
        confirmedAt: null,
        pickSet: null,
      };
    }

    const ps = pickSetByWeekId[dbWeek.id] ?? null;
    const isConfirmed = dbWeek.confirmedAt !== null;

    let correct = 0;
    let graded = 0;
    if (ps && isConfirmed) {
      for (const p of ps.picks) {
        if (p.isCorrect !== null) {
          graded++;
          if (p.isCorrect) correct++;
        }
      }
    }

    return {
      id: dbWeek.id,
      number: dbWeek.number,
      label: dbWeek.label,
      lockedForSubmission: dbWeek.lockedForSubmission,
      confirmedAt: dbWeek.confirmedAt,
      // pickSet is non-null if user has a submission; scores are zeroed if not yet confirmed
      pickSet: ps
        ? { correct, graded, total: ps.picks.length }
        : null,
    };
  });

  return NextResponse.json({
    season: { id: season.id, year: season.year },
    weeks: weekSlots,
    currentWeekId,
  });
}
