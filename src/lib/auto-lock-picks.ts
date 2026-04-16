import { prisma } from "@/lib/prisma";

/**
 * When games are locked (by cron or admin), create missing Pick records
 * for users who already have a PickSet but haven't picked those games.
 *
 * - Missed picks get `pickedTeamId: null` (counted as incorrect when graded)
 * - Exception: if the user's favorite team is playing in the locked game,
 *   auto-fill with the favorite team ID (gives them the team-pick bonus)
 */
export async function createMissedPicksForLockedGames(
  weekId: string,
  lockedGameIds: string[],
  leagueId: string
): Promise<{ created: number; autoFilled: number }> {
  if (lockedGameIds.length === 0) return { created: 0, autoFilled: 0 };

  // Get all users in this league who have a PickSet for this week
  const pickSets = await prisma.pickSet.findMany({
    where: {
      weekId,
      user: { userLeagues: { some: { leagueId } } },
    },
    select: {
      id: true,
      userId: true,
      picks: {
        where: { gameId: { in: lockedGameIds } },
        select: { gameId: true },
      },
    },
  });

  // Fetch locked games with their teams
  const lockedGames = await prisma.game.findMany({
    where: { id: { in: lockedGameIds } },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  const gameMap = new Map(lockedGames.map((g) => [g.id, g]));

  // Resolve all unique user favorite teams → team IDs
  const userIds = pickSets.map((ps) => ps.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, favoriteTeam: true },
  });
  const favTeamNames = [...new Set(users.map((u) => u.favoriteTeam))];
  const teams = await prisma.team.findMany({
    where: { name: { in: favTeamNames } },
    select: { id: true, name: true },
  });
  const nameToTeamId = new Map(teams.map((t) => [t.name, t.id]));
  const userFavTeamId = new Map<string, string>();
  for (const u of users) {
    const teamId = nameToTeamId.get(u.favoriteTeam);
    if (teamId) userFavTeamId.set(u.id, teamId);
  }

  let created = 0;
  let autoFilled = 0;

  for (const ps of pickSets) {
    const existingGameIds = new Set(ps.picks.map((p) => p.gameId));
    const missingGameIds = lockedGameIds.filter((gid) => !existingGameIds.has(gid));

    if (missingGameIds.length === 0) continue;

    const favTeamId = userFavTeamId.get(ps.userId);

    const picksToCreate = missingGameIds.map((gameId) => {
      const game = gameMap.get(gameId);
      // Auto-fill if user's favorite team is playing in this game
      const isFavTeamInGame =
        favTeamId && game && (game.homeTeamId === favTeamId || game.awayTeamId === favTeamId);

      if (isFavTeamInGame) {
        autoFilled++;
        return { pickSetId: ps.id, gameId, pickedTeamId: favTeamId };
      }

      created++;
      return { pickSetId: ps.id, gameId, pickedTeamId: null };
    });

    await prisma.pick.createMany({
      data: picksToCreate,
      skipDuplicates: true,
    });
  }

  return { created, autoFilled };
}
