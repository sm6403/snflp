import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminName } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pickSetId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pickSetId } = await params;
  const body = await request.json() as {
    action: "unlock" | "lock" | "editPick" | "replaceAllPicks" | "editLmsPick";
    pickId?: string;
    pickedTeamId?: string;
    picks?: Array<{ gameId: string; pickedTeamId: string }>;
    teamId?: string | null;
  };

  const pickSet = await prisma.pickSet.findUnique({
    where: { id: pickSetId },
    include: {
      user: { select: { email: true, alias: true, name: true } },
      week: { include: { season: true } },
    },
  });
  if (!pickSet) {
    return NextResponse.json({ error: "Pick set not found" }, { status: 404 });
  }

  const adminName = await getAdminName() ?? "unknown";
  const userLabel = pickSet.user.alias ?? pickSet.user.name ?? pickSet.user.email;
  const weekLabel = pickSet.week.label;
  const seasonYear = pickSet.week.season.year;

  if (body.action === "unlock") {
    const updated = await prisma.pickSet.update({
      where: { id: pickSetId },
      data: { lockedAt: null, lockedBy: null },
    });
    await logAdminAction(adminName, "UNLOCK_PICK_SET", { user: userLabel, weekLabel, seasonYear });
    return NextResponse.json({ pickSet: updated });
  }

  if (body.action === "lock") {
    const updated = await prisma.pickSet.update({
      where: { id: pickSetId },
      data: { lockedAt: new Date(), lockedBy: "admin" },
    });
    await logAdminAction(adminName, "LOCK_PICK_SET", { user: userLabel, weekLabel, seasonYear });
    return NextResponse.json({ pickSet: updated });
  }

  if (body.action === "editPick") {
    if (!body.pickId || !body.pickedTeamId) {
      return NextResponse.json({ error: "pickId and pickedTeamId required" }, { status: 400 });
    }

    const pick = await prisma.pick.findUnique({ where: { id: body.pickId } });
    if (!pick || pick.pickSetId !== pickSetId) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    // Validate the picked team is in the game
    const game = await prisma.game.findUnique({
      where: { id: pick.gameId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (body.pickedTeamId !== game.homeTeamId && body.pickedTeamId !== game.awayTeamId) {
      return NextResponse.json({ error: "Invalid team for this game" }, { status: 400 });
    }

    const newTeam = body.pickedTeamId === game.homeTeamId ? game.homeTeam : game.awayTeam;

    const updated = await prisma.pick.update({
      where: { id: body.pickId },
      data: { pickedTeamId: body.pickedTeamId, editedBy: "admin" },
      include: { pickedTeam: true },
    });

    await logAdminAction(adminName, "EDIT_PICK", {
      user: userLabel,
      weekLabel,
      seasonYear,
      game: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
      newPick: newTeam.abbreviation,
    });

    return NextResponse.json({ pick: updated });
  }

  if (body.action === "replaceAllPicks") {
    if (!Array.isArray(body.picks) || body.picks.length === 0) {
      return NextResponse.json({ error: "picks required" }, { status: 400 });
    }

    // Validate all picks reference games in this week
    const games = await prisma.game.findMany({
      where: { weekId: pickSet.weekId },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });
    const gameMap = new Map(games.map((g) => [g.id, g]));

    for (const pick of body.picks) {
      const game = gameMap.get(pick.gameId);
      if (!game) {
        return NextResponse.json({ error: `Game not found: ${pick.gameId}` }, { status: 400 });
      }
      if (pick.pickedTeamId !== game.homeTeamId && pick.pickedTeamId !== game.awayTeamId) {
        return NextResponse.json({ error: `Invalid team for game ${pick.gameId}` }, { status: 400 });
      }
    }

    const now = new Date();
    await prisma.$transaction([
      // Upsert every pick
      ...body.picks.map((p) =>
        prisma.pick.upsert({
          where: { pickSetId_gameId: { pickSetId, gameId: p.gameId } },
          create: { pickSetId, gameId: p.gameId, pickedTeamId: p.pickedTeamId, editedBy: "admin" },
          update: { pickedTeamId: p.pickedTeamId, editedBy: "admin" },
        })
      ),
      // Ensure the pick set is stamped as submitted + locked by admin
      prisma.pickSet.update({
        where: { id: pickSetId },
        data: {
          submittedAt: pickSet.submittedAt ?? now,
          lockedAt: now,
          lockedBy: "admin",
        },
      }),
    ]);

    await logAdminAction(adminName, "REPLACE_ALL_PICKS", {
      user: userLabel,
      weekLabel,
      seasonYear,
      pickCount: body.picks.length,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "editLmsPick") {
    const existing = await prisma.lmsPick.findUnique({
      where: { userId_weekId: { userId: pickSet.userId, weekId: pickSet.weekId } },
    });

    if (existing) {
      await prisma.lmsPick.update({
        where: { userId_weekId: { userId: pickSet.userId, weekId: pickSet.weekId } },
        data: { teamId: body.teamId ?? null },
      });
    } else {
      const week = await prisma.week.findUnique({
        where: { id: pickSet.weekId },
        include: { season: true },
      });
      if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });
      await prisma.lmsPick.create({
        data: {
          userId: pickSet.userId,
          weekId: pickSet.weekId,
          seasonId: week.seasonId,
          teamId: body.teamId ?? null,
          lmsRound: week.season.ruleLMSRound ?? 1,
        },
      });
    }

    await logAdminAction(adminName, "EDIT_LMS_PICK", { user: userLabel, weekLabel, seasonYear });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
