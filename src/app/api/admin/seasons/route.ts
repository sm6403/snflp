import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// GET /api/admin/seasons
// Returns all seasons with week counts and per-week game counts.
export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [seasons, eligibleUsersCount] = await Promise.all([
    prisma.season.findMany({
      orderBy: [{ year: "desc" }, { type: "asc" }],
      select: {
        id: true, year: true, type: true, mode: true,
        isCurrent: true, timedAutolocking: true, ruleFavouriteTeamBonusWin: true, createdAt: true,
        parentSeasonId: true,
        parentSeason: { select: { id: true, year: true, type: true } },
        _count: { select: { weeks: true } },
        weeks: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            label: true,
            isCurrent: true,
            lockedForSubmission: true,
            confirmedAt: true,
            _count: {
              select: {
                games: true,
                pickSets: { where: { user: { showOnLeaderboard: true } } },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { showOnLeaderboard: true } }),
  ]);

  return NextResponse.json({ seasons, eligibleUsersCount });
}

// POST /api/admin/seasons
// Creates a new season. Regular seasons get 18 weeks auto-created.
export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    year: number;
    type: "regular" | "postseason";
    mode: "live" | "test";
    parentSeasonId?: string;
  };

  const { year, type, mode, parentSeasonId } = body;

  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (type !== "regular" && type !== "postseason") {
    return NextResponse.json({ error: "type must be 'regular' or 'postseason'" }, { status: 400 });
  }
  if (mode !== "live" && mode !== "test") {
    return NextResponse.json({ error: "mode must be 'live' or 'test'" }, { status: 400 });
  }
  if (type === "postseason" && !parentSeasonId) {
    return NextResponse.json({ error: "parentSeasonId required for postseason" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.season.findUnique({ where: { year_type: { year, type } } });
  if (existing) {
    return NextResponse.json(
      { error: `A ${type} season for ${year} already exists` },
      { status: 409 }
    );
  }

  // Validate parent season exists
  if (parentSeasonId) {
    const parent = await prisma.season.findUnique({ where: { id: parentSeasonId } });
    if (!parent) {
      return NextResponse.json({ error: "Parent season not found" }, { status: 400 });
    }
  }

  // Build week data for regular seasons
  const weekData = type === "regular"
    ? Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        label: `Week ${i + 1}`,
      }))
    : [];

  const season = await prisma.$transaction(async (tx) => {
    const s = await tx.season.create({
      data: {
        year,
        type,
        mode,
        parentSeasonId: parentSeasonId ?? null,
        isCurrent: false,
        weeks: {
          create: weekData,
        },
      },
      include: {
        weeks: { orderBy: { number: "asc" }, select: { id: true, number: true, label: true } },
        parentSeason: { select: { id: true, year: true, type: true } },
      },
    });
    return s;
  });

  return NextResponse.json({ season }, { status: 201 });
}
