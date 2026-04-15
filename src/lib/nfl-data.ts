import { prisma } from "@/lib/prisma";

export async function getCurrentWeek(leagueId: string) {
  const settings = await prisma.leagueSettings.findUnique({
    where: { leagueId },
  });

  if (settings?.mode === "test" && settings.testWeekId) {
    return prisma.week.findUnique({
      where: { id: settings.testWeekId },
      include: { season: true },
    });
  }

  return prisma.week.findFirst({
    where: { isCurrent: true, season: { leagueId, isCurrent: true } },
    include: { season: true },
  });
}

export async function getGamesForWeek(weekId: string) {
  // Resolve the season so we can scope team records to it
  const weekInfo = await prisma.week.findUnique({
    where: { id: weekId },
    select: { seasonId: true },
  });
  const seasonId = weekInfo?.seasonId;

  return prisma.game.findMany({
    where: { weekId },
    include: {
      homeTeam: {
        include: {
          // Most recent record from a *confirmed* week in this season
          teamRecords: {
            where: seasonId
              ? { week: { seasonId, confirmedAt: { not: null } } }
              : { week: { confirmedAt: { not: null } } },
            orderBy: { week: { number: "desc" } },
            take: 1,
          },
        },
      },
      awayTeam: {
        include: {
          teamRecords: {
            where: seasonId
              ? { week: { seasonId, confirmedAt: { not: null } } }
              : { week: { confirmedAt: { not: null } } },
            orderBy: { week: { number: "desc" } },
            take: 1,
          },
        },
      },
      winner: true,
    },
    orderBy: { gameTime: "asc" },
  });
}
