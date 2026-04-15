import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export interface EspnGame {
  homeTeamId: string;
  awayTeamId: string;
  /** ISO 8601 UTC, e.g. "2025-09-07T17:00:00.000Z" */
  gameTime: string | null;
  homeTeamName: string;
  awayTeamName: string;
}

// ─── ESPN response types (unofficial API — shape may change) ──────────────────

interface EspnCompetitor {
  homeAway: "home" | "away";
  /** Some versions of the API embed team data directly on competitor */
  abbreviation?: string;
  displayName?: string;
  team?: {
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
}

interface EspnEvent {
  id: string;
  name: string;
  competitions?: Array<{
    date?: string;
    competitors?: EspnCompetitor[];
  }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAbbr(c: EspnCompetitor): string {
  // Abbreviation may be on c.team.abbreviation or directly on c.abbreviation
  return (c.team?.abbreviation ?? c.abbreviation ?? "").toUpperCase();
}

function getDisplayName(c: EspnCompetitor): string {
  return c.team?.displayName ?? c.team?.shortDisplayName ?? c.displayName ?? getAbbr(c);
}

// ─── GET /api/admin/espn/schedule ─────────────────────────────────────────────
//
// Query params:
//   year        — e.g. 2025
//   week        — week number (1–18 regular season; 1–5 postseason)
//   seasontype  — "2" = regular (default), "3" = postseason

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const year = searchParams.get("year");
  const week = searchParams.get("week");
  const seasontype = searchParams.get("seasontype") ?? "2";

  if (!year || !week) {
    return NextResponse.json({ error: "year and week are required" }, { status: 400 });
  }

  const yearNum = parseInt(year, 10);
  const weekNum = parseInt(week, 10);
  if (isNaN(yearNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 22) {
    return NextResponse.json({ error: "Invalid year or week" }, { status: 400 });
  }

  // ── Fetch from ESPN ──────────────────────────────────────────────────────────
  const espnUrl =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
    `?seasontype=${encodeURIComponent(seasontype)}` +
    `&week=${encodeURIComponent(weekNum)}` +
    `&dates=${encodeURIComponent(yearNum)}`;

  let scoreboard: EspnScoreboard;
  try {
    const res = await fetch(espnUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      // Next.js cache — no caching; schedules can change
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
    return NextResponse.json({ games: [], unmappedTeams: [] });
  }

  // ── Load teams from DB for mapping ───────────────────────────────────────────
  // espnId is the lowercase abbreviation (e.g. "kc", "phi")
  const dbTeams = await prisma.team.findMany({
    select: { id: true, name: true, abbreviation: true, espnId: true },
  });
  // Map espnId → team (espnId IS the lowercase abbreviation)
  const teamByEspnId = new Map(dbTeams.map((t) => [t.espnId, t]));

  // ── Map ESPN events → games ───────────────────────────────────────────────────
  const games: EspnGame[] = [];
  const unmappedTeams: string[] = [];

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const homeComp = comp.competitors?.find((c) => c.homeAway === "home");
    const awayComp = comp.competitors?.find((c) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const homeAbbr = getAbbr(homeComp);
    const awayAbbr = getAbbr(awayComp);

    const homeTeam = teamByEspnId.get(homeAbbr.toLowerCase());
    const awayTeam = teamByEspnId.get(awayAbbr.toLowerCase());

    if (!homeTeam) {
      if (!unmappedTeams.includes(homeAbbr)) unmappedTeams.push(homeAbbr);
    }
    if (!awayTeam) {
      if (!unmappedTeams.includes(awayAbbr)) unmappedTeams.push(awayAbbr);
    }
    if (!homeTeam || !awayTeam) continue;

    games.push({
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      gameTime: comp.date ?? null,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    });
  }

  return NextResponse.json({ games, unmappedTeams });
}
