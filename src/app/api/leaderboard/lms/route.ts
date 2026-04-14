import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard/lms
// Returns Last Man Standing standings for the current season.
export async function GET() {
  const session = await auth();
  const isAdmin = !session?.user?.id && (await verifyAdminSession());
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) {
    return NextResponse.json({ season: null, ruleLMS: false, players: [] });
  }

  if (!season.ruleLMS) {
    return NextResponse.json({
      season: { id: season.id, year: season.year },
      ruleLMS: false,
      players: [],
    });
  }

  // Fetch all LMS picks for this season with related data
  const lmsPicks = await prisma.lmsPick.findMany({
    where: { seasonId: season.id },
    include: {
      user: { select: { id: true, name: true, alias: true, showOnLeaderboard: true } },
      week: { select: { id: true, number: true, label: true, confirmedAt: true } },
      team: { select: { id: true, name: true, abbreviation: true, espnId: true } },
    },
    orderBy: { week: { number: "asc" } },
  });

  // Fetch all confirmed games for this season to determine win/loss per pick
  const confirmedGames = await prisma.game.findMany({
    where: {
      week: { seasonId: season.id, confirmedAt: { not: null } },
    },
    select: { weekId: true, homeTeamId: true, awayTeamId: true, winnerId: true, isTie: true },
  });

  // Index: weekId -> Set of losing teamIds
  const losingTeamsByWeek = new Map<string, Set<string>>();
  const playingTeamsByWeek = new Map<string, Set<string>>();
  for (const game of confirmedGames) {
    if (!playingTeamsByWeek.has(game.weekId)) playingTeamsByWeek.set(game.weekId, new Set());
    playingTeamsByWeek.get(game.weekId)!.add(game.homeTeamId);
    playingTeamsByWeek.get(game.weekId)!.add(game.awayTeamId);

    if (!losingTeamsByWeek.has(game.weekId)) losingTeamsByWeek.set(game.weekId, new Set());
    if (game.winnerId) {
      const loserId = game.homeTeamId === game.winnerId ? game.awayTeamId : game.homeTeamId;
      losingTeamsByWeek.get(game.weekId)!.add(loserId);
    } else if (game.isTie) {
      losingTeamsByWeek.get(game.weekId)!.add(game.homeTeamId);
      losingTeamsByWeek.get(game.weekId)!.add(game.awayTeamId);
    }
  }

  // Group picks by user
  const userMap = new Map<
    string,
    {
      userId: string;
      displayName: string;
      showOnLeaderboard: boolean;
      eliminated: boolean;
      eliminatedWeekNumber: number | null;
      picks: {
        weekId: string;
        weekNumber: number;
        weekLabel: string;
        team: { id: string; name: string; abbreviation: string; espnId: string };
        result: "win" | "loss" | "tie" | "pending";
        isEliminatedPick: boolean;
      }[];
    }
  >();

  for (const pick of lmsPicks) {
    const uid = pick.userId;
    if (!userMap.has(uid)) {
      const u = pick.user;
      userMap.set(uid, {
        userId: uid,
        displayName: u.alias ?? u.name ?? "Unknown",
        showOnLeaderboard: u.showOnLeaderboard,
        eliminated: false,
        eliminatedWeekNumber: null,
        picks: [],
      });
    }
    const entry = userMap.get(uid)!;

    // Derive result for this pick
    let result: "win" | "loss" | "tie" | "pending" = "pending";
    if (pick.week.confirmedAt) {
      const losers = losingTeamsByWeek.get(pick.weekId);
      if (losers?.has(pick.teamId)) {
        result = pick.eliminated ? "loss" : "tie"; // eliminated=true means loss or tie
        result = "loss"; // simplify: any confirmed loss = "loss" in display
      } else {
        result = "win";
      }
    }

    if (pick.eliminated) {
      entry.eliminated = true;
      if (entry.eliminatedWeekNumber === null || pick.week.number > entry.eliminatedWeekNumber) {
        entry.eliminatedWeekNumber = pick.week.number;
      }
    }

    entry.picks.push({
      weekId: pick.weekId,
      weekNumber: pick.week.number,
      weekLabel: pick.week.label,
      team: pick.team,
      result,
      isEliminatedPick: pick.eliminated,
    });
  }

  // Build sorted player list: active first (by earliest week desc = most picks), then eliminated
  const players = [...userMap.values()];

  players.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    // Both active: sort by number of picks desc (more picks = further along)
    if (!a.eliminated && !b.eliminated) return b.picks.length - a.picks.length;
    // Both eliminated: sort by elimination week desc (eliminated later = higher)
    if (a.eliminated && b.eliminated) {
      return (b.eliminatedWeekNumber ?? 0) - (a.eliminatedWeekNumber ?? 0);
    }
    return 0;
  });

  return NextResponse.json({
    season: { id: season.id, year: season.year },
    ruleLMS: true,
    players: players.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      showOnLeaderboard: p.showOnLeaderboard,
      status: p.eliminated ? "eliminated" : "active",
      eliminatedWeekNumber: p.eliminatedWeekNumber,
      picks: p.picks,
    })),
  });
}
