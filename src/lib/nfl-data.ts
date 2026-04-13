import { prisma } from "@/lib/prisma";

export async function getCurrentWeek() {
  const settings = await prisma.appSettings.findFirst();

  if (settings?.mode === "test" && settings.testWeekId) {
    return prisma.week.findUnique({
      where: { id: settings.testWeekId },
      include: { season: true },
    });
  }

  return prisma.week.findFirst({
    where: { isCurrent: true },
    include: { season: true },
  });
}

export async function getGamesForWeek(weekId: string) {
  return prisma.game.findMany({
    where: { weekId },
    include: {
      homeTeam: {
        include: { teamRecords: { where: { weekId } } },
      },
      awayTeam: {
        include: { teamRecords: { where: { weekId } } },
      },
      winner: true,
    },
    orderBy: { gameTime: "asc" },
  });
}
