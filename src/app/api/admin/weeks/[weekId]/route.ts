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
// Currently supports: { isCurrent: true } — sets this week as current, clears others in the season.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = await params;
  const body = await request.json() as { isCurrent?: boolean };

  const week = await prisma.week.findUnique({ where: { id: weekId }, select: { id: true, seasonId: true } });
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  if (body.isCurrent === true) {
    await prisma.$transaction([
      prisma.week.updateMany({ where: { seasonId: week.seasonId }, data: { isCurrent: false } }),
      prisma.week.update({ where: { id: weekId }, data: { isCurrent: true } }),
    ]);
  }

  return NextResponse.json({ success: true });
}
