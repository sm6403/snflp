import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCurrentWeek } from "@/lib/nfl-data";

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekIdParam = searchParams.get("weekId");

  let week;
  if (weekIdParam) {
    week = await prisma.week.findUnique({
      where: { id: weekIdParam },
      include: { season: true },
    });
  } else {
    week = await getCurrentWeek();
  }

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  // Server-side auto-lock: if lockAt has passed and week isn't locked yet, lock it now
  if (week.lockAt && !week.lockedForSubmission && new Date(week.lockAt) <= new Date()) {
    week = await prisma.week.update({
      where: { id: week.id },
      data: { lockedForSubmission: true },
      include: { season: true },
    });
  }

  const pickSets = await prisma.pickSet.findMany({
    where: { weekId: week.id },
    include: {
      user: { select: { id: true, name: true, email: true, alias: true } },
      picks: {
        include: {
          pickedTeam: true,
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Games for the Confirm Results UI
  const games = await prisma.game.findMany({
    where: { weekId: week.id },
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: [{ gameTime: "asc" }, { id: "asc" }],
  });

  // All weeks for the selector dropdown
  const weeks = await prisma.week.findMany({
    orderBy: [{ season: { year: "desc" } }, { number: "asc" }],
    include: { season: { select: { year: true } } },
  });

  return NextResponse.json({ week, pickSets, weeks, games });
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    action: "lockWeek" | "unlockWeek" | "setLockTime" | "clearLockTime";
    weekId: string;
    lockAt?: string; // ISO string (UTC)
  };

  if (!body.weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  if (body.action === "lockWeek") {
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockedForSubmission: true },
    });
    return NextResponse.json({ week });
  }

  if (body.action === "unlockWeek") {
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockedForSubmission: false },
    });
    return NextResponse.json({ week });
  }

  if (body.action === "setLockTime") {
    if (!body.lockAt) {
      return NextResponse.json({ error: "lockAt required" }, { status: 400 });
    }
    const lockAtDate = new Date(body.lockAt);
    if (isNaN(lockAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid lockAt date" }, { status: 400 });
    }
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockAt: lockAtDate },
    });
    return NextResponse.json({ week });
  }

  if (body.action === "clearLockTime") {
    const week = await prisma.week.update({
      where: { id: body.weekId },
      data: { lockAt: null },
    });
    return NextResponse.json({ week });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
