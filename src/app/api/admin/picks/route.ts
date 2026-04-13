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

  // All weeks for the selector dropdown
  const weeks = await prisma.week.findMany({
    orderBy: [{ season: { year: "desc" } }, { number: "asc" }],
    include: { season: { select: { year: true } } },
  });

  return NextResponse.json({ week, pickSets, weeks });
}
