import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ seasonId: string }> };

// PATCH /api/admin/seasons/[seasonId]
// Update season metadata (isCurrent, mode). Also supports adding a week to post-seasons.
export async function PATCH(request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { seasonId } = await params;
  const body = await request.json() as {
    isCurrent?: boolean;
    mode?: "live" | "test";
    addWeek?: boolean; // adds one new week at the end (for postseason)
    timedAutolocking?: boolean;
    ruleFavouriteTeamBonusWin?: boolean;
    ruleLMS?: boolean;
    incrementLMSRound?: boolean; // start a new LMS round
    usesDivisions?: boolean;
  };

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  if (body.mode && body.mode !== "live" && body.mode !== "test") {
    return NextResponse.json({ error: "mode must be 'live' or 'test'" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // If setting isCurrent=true, clear it on all other seasons first
    if (body.isCurrent === true) {
      await tx.season.updateMany({
        where: { id: { not: seasonId } },
        data: { isCurrent: false },
      });
    }

    const s = await tx.season.update({
      where: { id: seasonId },
      data: {
        ...(body.isCurrent !== undefined && { isCurrent: body.isCurrent }),
        ...(body.mode && { mode: body.mode }),
        ...(body.timedAutolocking !== undefined && { timedAutolocking: body.timedAutolocking }),
        ...(body.ruleFavouriteTeamBonusWin !== undefined && { ruleFavouriteTeamBonusWin: body.ruleFavouriteTeamBonusWin }),
        ...(body.ruleLMS !== undefined && { ruleLMS: body.ruleLMS }),
        ...(body.incrementLMSRound && { ruleLMSRound: { increment: 1 } }),
        ...(body.usesDivisions !== undefined && { usesDivisions: body.usesDivisions }),
      },
      include: {
        parentSeason: { select: { id: true, year: true, type: true } },
        _count: { select: { weeks: true } },
        weeks: {
          orderBy: { number: "asc" },
          select: {
            id: true, number: true, label: true,
            isCurrent: true, lockedForSubmission: true, confirmedAt: true,
            _count: { select: { games: true } },
          },
        },
      },
    });

    // Auto-create default division when usesDivisions is first enabled
    if (body.usesDivisions === true) {
      const existing = await tx.division.findFirst({ where: { seasonId, isDefault: true } });
      if (!existing) {
        await tx.division.create({
          data: { seasonId, name: "SNFLP Division", isDefault: true },
        });
      }
    }

    // Add a week (postseason)
    if (body.addWeek) {
      const maxWeek = await tx.week.findFirst({
        where: { seasonId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const nextNumber = (maxWeek?.number ?? 0) + 1;
      await tx.week.create({
        data: {
          seasonId,
          number: nextNumber,
          label: `Week ${nextNumber}`,
        },
      });
    }

    return s;
  });

  return NextResponse.json({ season: updated });
}

// DELETE /api/admin/seasons/[seasonId]
// Deletes the season and all related data. Blocked if any week has confirmedAt set.
export async function DELETE(_request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { seasonId } = await params;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { weeks: { select: { id: true, confirmedAt: true } } },
  });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const hasConfirmed = season.weeks.some((w) => w.confirmedAt !== null);
  if (hasConfirmed) {
    return NextResponse.json(
      { error: "Cannot delete a season with confirmed results. Reset all weeks first." },
      { status: 409 }
    );
  }

  const weekIds = season.weeks.map((w) => w.id);

  await prisma.$transaction(async (tx) => {
    if (weekIds.length > 0) {
      // Delete picks → pick sets → games → team records → weeks
      const games = await tx.game.findMany({ where: { weekId: { in: weekIds } }, select: { id: true } });
      const gameIds = games.map((g) => g.id);
      if (gameIds.length > 0) {
        await tx.pick.deleteMany({ where: { gameId: { in: gameIds } } });
      }
      const pickSets = await tx.pickSet.findMany({ where: { weekId: { in: weekIds } }, select: { id: true } });
      const pickSetIds = pickSets.map((ps) => ps.id);
      if (pickSetIds.length > 0) {
        await tx.pick.deleteMany({ where: { pickSetId: { in: pickSetIds } } });
        await tx.pickSet.deleteMany({ where: { id: { in: pickSetIds } } });
      }
      await tx.game.deleteMany({ where: { weekId: { in: weekIds } } });
      await tx.teamRecord.deleteMany({ where: { weekId: { in: weekIds } } });
      await tx.week.deleteMany({ where: { id: { in: weekIds } } });
    }
    await tx.season.delete({ where: { id: seasonId } });
  });

  return NextResponse.json({ deleted: true });
}
