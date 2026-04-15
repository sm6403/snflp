import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export interface EspnResult {
  gameId: string;
  /** Local DB team ID of the winner, or null for a tie */
  winnerId: string | null;
  isTie: boolean;
  /** True when ESPN has a final score for this game */
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

// ─── ESPN response types ──────────────────────────────────────────────────────

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  abbreviation?: string;
  team?: { abbreviation?: string };
}

interface EspnEvent {
  competitions?: Array<{
    date?: string;
    status?: { type?: { completed?: boolean; description?: string } };
    competitors?: EspnCompetitor[];
  }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

function getAbbr(c: EspnCompetitor): string {
  return (c.team?.abbreviation ?? c.abbreviation ?? "").toUpperCase();
}

// ─── GET /api/admin/espn/results ──────────────────────────────────────────────
//
// Query params:
//   weekId — the DB week ID to fetch results for
//
// Returns results for all completed games in the week, matched to local game IDs.
// Games not yet completed (in-progress or scheduled) are omitted.

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekId = request.nextUrl.searchParams.get("weekId");
  if (!weekId) {
    return NextResponse.json({ error: "weekId is required" }, { status: 400 });
  }

  // ── Load week + games from DB ─────────────────────────────────────────────
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      season: { select: { year: true, type: true } },
      games: {
        include: {
          homeTeam: { select: { id: true, espnId: true, name: true } },
          awayTeam: { select: { id: true, espnId: true, name: true } },
        },
        orderBy: [{ gameTime: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  if (week.games.length === 0) {
    return NextResponse.json({ results: [], message: "No games scheduled for this week" });
  }

  // ── Build local game lookup: "HOMEABBR:AWAYABBR" → game ──────────────────
  const localGameByKey = new Map(
    week.games.map((g) => [
      `${g.homeTeam.espnId.toUpperCase()}:${g.awayTeam.espnId.toUpperCase()}`,
      g,
    ])
  );

  // ── Fetch from ESPN ──────────────────────────────────────────────────────
  const seasonType = week.season.type === "postseason" ? "3" : "2";
  const espnUrl =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
    `?seasontype=${seasonType}` +
    `&week=${week.number}` +
    `&dates=${week.season.year}`;

  let scoreboard: EspnScoreboard;
  try {
    const res = await fetch(espnUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ESPN API returned ${res.status}` },
        { status: 502 }
      );
    }
    scoreboard = (await res.json()) as EspnScoreboard;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return NextResponse.json({ error: `ESPN fetch failed: ${msg}` }, { status: 502 });
  }

  const events = scoreboard.events ?? [];
  if (events.length === 0) {
    return NextResponse.json({
      results: [],
      message: "ESPN returned no events for this week",
    });
  }

  // ── Match ESPN events to local games and determine winners ───────────────
  const results: EspnResult[] = [];
  let unmatchedCount = 0;

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const homeComp = comp.competitors?.find((c) => c.homeAway === "home");
    const awayComp = comp.competitors?.find((c) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const homeAbbr = getAbbr(homeComp).toUpperCase();
    const awayAbbr = getAbbr(awayComp).toUpperCase();

    // Find matching local game by home+away team pair
    const localGame = localGameByKey.get(`${homeAbbr}:${awayAbbr}`);
    if (!localGame) {
      unmatchedCount++;
      continue;
    }

    const completed = comp.status?.type?.completed === true;

    if (!completed) {
      // Game not yet finished — skip (don't overwrite any result the admin already set)
      continue;
    }

    const homeScore = parseFloat(homeComp.score ?? "") ?? null;
    const awayScore = parseFloat(awayComp.score ?? "") ?? null;

    let winnerId: string | null = null;
    let isTie = false;

    if (!isNaN(homeScore) && !isNaN(awayScore)) {
      if (homeScore > awayScore) {
        winnerId = localGame.homeTeam.id;
      } else if (awayScore > homeScore) {
        winnerId = localGame.awayTeam.id;
      } else {
        // Equal scores = tie
        isTie = true;
        winnerId = null;
      }
    }

    results.push({
      gameId: localGame.id,
      winnerId,
      isTie,
      completed,
      homeScore: isNaN(homeScore) ? null : homeScore,
      awayScore: isNaN(awayScore) ? null : awayScore,
    });
  }

  return NextResponse.json({
    results,
    unmatchedCount,
    totalEspnGames: events.length,
  });
}
