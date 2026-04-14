import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard/lms?round=N
// Returns Last Man Standing standings for the current season.
// All showOnLeaderboard users are included — missing a pick counts as elimination.
// If ?round=N is provided, returns standings for that round; otherwise defaults to current round.
export async function GET(request: Request) {
  const session = await auth();
  const isAdmin = !session?.user?.id && (await verifyAdminSession());
  if (!session?.user?.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roundParam = searchParams.get("round");

  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) {
    return NextResponse.json({ season: null, ruleLMS: false, lmsRound: 1, availableRounds: [], players: [] });
  }

  const currentRound = season.ruleLMSRound;

  if (!season.ruleLMS) {
    return NextResponse.json({
      season: { id: season.id, year: season.year },
      ruleLMS: false,
      lmsRound: currentRound,
      availableRounds: [],
      players: [],
    });
  }

  // Determine which rounds have any picks (i.e. have been played)
  const roundsWithPicks = await prisma.lmsPick.findMany({
    where: { seasonId: season.id },
    select: { lmsRound: true },
    distinct: ["lmsRound"],
    orderBy: { lmsRound: "asc" },
  });
  const availableRounds = roundsWithPicks.map((r) => r.lmsRound);
  // Always include the current round even if no picks yet
  if (!availableRounds.includes(currentRound)) availableRounds.push(currentRound);

  // Which round to show — default to current
  const requestedRound = roundParam ? parseInt(roundParam, 10) : currentRound;
  const viewRound = availableRounds.includes(requestedRound) ? requestedRound : currentRound;

  // All eligible users
  const eligibleUsers = await prisma.user.findMany({
    where: { showOnLeaderboard: true },
    select: { id: true, name: true, alias: true },
  });

  // LMS picks for the requested round
  const lmsPicks = await prisma.lmsPick.findMany({
    where: { seasonId: season.id, lmsRound: viewRound },
    include: {
      week: { select: { id: true, number: true, label: true, confirmedAt: true } },
      team: { select: { id: true, name: true, abbreviation: true, espnId: true } },
    },
    orderBy: { week: { number: "asc" } },
  });

  // Group LMS picks by userId
  const picksByUser = new Map<string, typeof lmsPicks>();
  for (const pick of lmsPicks) {
    if (!picksByUser.has(pick.userId)) picksByUser.set(pick.userId, []);
    picksByUser.get(pick.userId)!.push(pick);
  }

  // Build player list from all eligible users
  const players = eligibleUsers.map((user) => {
    const userPicks = picksByUser.get(user.id) ?? [];

    const eliminatedPick = userPicks.find((p) => p.eliminated);
    const isEliminated = !!eliminatedPick;
    const eliminatedWeekNumber = eliminatedPick?.week.number ?? null;

    const picks = userPicks.map((pick) => ({
      weekId: pick.weekId,
      weekNumber: pick.week.number,
      weekLabel: pick.week.label,
      team: pick.team ?? null,
      result: deriveResult(pick),
      isEliminatedPick: pick.eliminated,
    }));

    return {
      userId: user.id,
      displayName: user.alias ?? user.name ?? "Unknown",
      status: isEliminated ? "eliminated" : "active",
      eliminatedWeekNumber,
      picks,
    };
  });

  // Sort: active first (most picks = furthest along), then eliminated (later = higher)
  players.sort((a, b) => {
    if (a.status !== b.status) return a.status === "eliminated" ? 1 : -1;
    if (a.status === "active") return b.picks.length - a.picks.length;
    return (b.eliminatedWeekNumber ?? 0) - (a.eliminatedWeekNumber ?? 0);
  });

  return NextResponse.json({
    season: { id: season.id, year: season.year },
    ruleLMS: true,
    lmsRound: viewRound,
    currentRound,
    availableRounds,
    players,
  });
}

function deriveResult(pick: {
  teamId: string | null;
  eliminated: boolean;
  week: { confirmedAt: Date | string | null };
}): "win" | "loss" | "no_pick" | "pending" {
  if (!pick.week.confirmedAt) return "pending";
  if (!pick.teamId) return "no_pick";
  if (pick.eliminated) return "loss";
  return "win";
}
