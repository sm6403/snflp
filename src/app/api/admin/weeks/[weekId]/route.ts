import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// GET /api/admin/weeks/[weekId]
// Returns the week (with season), its current games, and all 32 NFL teams for the schedule editor.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = await params;

  const [week, allTeams] = await Promise.all([
    prisma.week.findUnique({
      where: { id: weekId },
      include: {
        season: { select: { id: true, year: true, type: true, mode: true } },
        games: {
          orderBy: [{ gameTime: "asc" }, { id: "asc" }],
          include: {
            homeTeam: { select: { id: true, name: true, abbreviation: true, espnId: true } },
            awayTeam: { select: { id: true, name: true, abbreviation: true, espnId: true } },
          },
        },
      },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, abbreviation: true, espnId: true },
    }),
  ]);

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  return NextResponse.json({ week, allTeams });
}

// PATCH /api/admin/weeks/[weekId]
// Supports: { isCurrent: true } and/or { lockedForSubmission: boolean }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = await params;
  const body = await request.json() as { isCurrent?: boolean; lockedForSubmission?: boolean };

  const week = await prisma.week.findUnique({ where: { id: weekId }, select: { id: true, seasonId: true } });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  if (body.isCurrent === true) {
    // Resolve leagueId from the season
    const season = await prisma.season.findUnique({ where: { id: week.seasonId }, select: { leagueId: true } });
    const leagueId = season?.leagueId;

    await prisma.$transaction(async (tx) => {
      await tx.week.updateMany({ where: { seasonId: week.seasonId }, data: { isCurrent: false } });
      // Set as current and ensure it's unlocked so users can submit picks
      await tx.week.update({ where: { id: weekId }, data: { isCurrent: true, lockedForSubmission: false } });
      if (leagueId) {
        await tx.leagueSettings.upsert({
          where: { leagueId },
          create: { leagueId, mode: "live", testSeasonId: week.seasonId, testWeekId: weekId },
          update: { testSeasonId: week.seasonId, testWeekId: weekId },
        });
      }
    });
  }

  if (body.lockedForSubmission !== undefined) {
    await prisma.week.update({
      where: { id: weekId },
      data: {
        lockedForSubmission: body.lockedForSubmission,
        // Unlocking clears the scheduled lockAt so the cron doesn't immediately re-lock
        ...(body.lockedForSubmission === false && { lockAt: null }),
      },
    });
  }

  return NextResponse.json({ success: true });
}
