import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmWeek } from "@/lib/confirm-week";
import { logAdminAction } from "@/lib/admin-log";

// GET /api/cron/auto-results
//
// Called every 15 minutes by cron-job.org (same cadence as send-reminders).
// For each league with autoResultsEnabled = true, checks whether the current
// UTC time falls within a 20-minute window of the configured processing time.
// If so, and if there is a locked-but-unconfirmed current week, it:
//
//   1. Fetches final scores from ESPN
//   2. Sets game winners in the DB
//   3. Confirms the week (grades picks, stamps confirmedAt, recomputes records)
//   4. Optionally advances to the next week
//
// The Week.confirmedAt field naturally prevents double-processing: once confirmed,
// the week is no longer findable in step 2 and subsequent cron runs are no-ops.
//
// Protected by CRON_SECRET env var (?secret=... or Authorization: Bearer header).

// ─── ESPN types (minimal) ─────────────────────────────────────────────────────

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  abbreviation?: string;
  team?: { abbreviation?: string };
}

interface EspnEvent {
  competitions?: Array<{
    status?: { type?: { completed?: boolean } };
    competitors?: EspnCompetitor[];
  }>;
}

function espnAbbr(c: EspnCompetitor): string {
  return (c.team?.abbreviation ?? c.abbreviation ?? "").toUpperCase();
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = searchParams.get("secret");
    if (headerSecret !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const results: Array<{
    leagueId: string;
    status: "processed" | "skipped" | "partial" | "error";
    detail: string;
  }> = [];

  // ── Process each league ───────────────────────────────────────────────────────
  const leagues = await prisma.leagueSettings.findMany({
    where: { autoResultsEnabled: true },
  });

  for (const settings of leagues) {
    const {
      leagueId,
      autoResultsDayOfWeek,
      autoResultsHourUtc,
      autoResultsMinuteUtc,
      autoResultsAdvanceWeek,
    } = settings;

    // ── 1. Time window check (same 20-min pattern as send-reminders) ─────────
    const targetMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      autoResultsHourUtc,
      autoResultsMinuteUtc,
      0
    );
    const windowEndMs = targetMs + 20 * 60 * 1000;

    if (now.getUTCDay() !== autoResultsDayOfWeek || now.getTime() < targetMs || now.getTime() > windowEndMs) {
      results.push({ leagueId, status: "skipped", detail: "Outside configured time window" });
      continue;
    }

    try {
      // ── 2. Find the target week ─────────────────────────────────────────────
      const week = await prisma.week.findFirst({
        where: {
          isCurrent: true,
          lockedForSubmission: true,
          confirmedAt: null,
          season: { leagueId },
        },
        include: {
          season: { select: { id: true, type: true, year: true, leagueId: true } },
          games: {
            include: {
              homeTeam: { select: { id: true, espnId: true } },
              awayTeam: { select: { id: true, espnId: true } },
            },
          },
        },
      });

      if (!week) {
        results.push({ leagueId, status: "skipped", detail: "No locked, unconfirmed current week found" });
        continue;
      }

      // ── 3. Fetch ESPN scores ─────────────────────────────────────────────────
      const seasonType = week.season.type === "postseason" ? "3" : "2";
      const espnUrl =
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` +
        `?seasontype=${seasonType}&week=${week.number}&dates=${week.season.year}`;

      const espnRes = await fetch(espnUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });

      if (!espnRes.ok) {
        results.push({ leagueId, status: "error", detail: `ESPN API returned ${espnRes.status}` });
        await logAdminAction("auto-results", "AUTO_RESULTS_ERROR", { leagueId, error: `ESPN ${espnRes.status}` });
        continue;
      }

      const scoreboard = await espnRes.json() as { events?: EspnEvent[] };
      const events = scoreboard.events ?? [];

      // ── 4. Build local game lookup and set winners ───────────────────────────
      const gameByKey = new Map(
        week.games.map((g) => [
          `${g.homeTeam.espnId.toUpperCase()}:${g.awayTeam.espnId.toUpperCase()}`,
          g,
        ])
      );

      let gamesSet = 0;
      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp?.status?.type?.completed) continue;

        const homeComp = comp.competitors?.find((c) => c.homeAway === "home");
        const awayComp = comp.competitors?.find((c) => c.homeAway === "away");
        if (!homeComp || !awayComp) continue;

        const localGame = gameByKey.get(`${espnAbbr(homeComp)}:${espnAbbr(awayComp)}`);
        if (!localGame) continue;

        const homeScore = parseFloat(homeComp.score ?? "");
        const awayScore = parseFloat(awayComp.score ?? "");

        let winnerId: string | null = null;
        let isTie = false;
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
          if (homeScore > awayScore) winnerId = localGame.homeTeam.id;
          else if (awayScore > homeScore) winnerId = localGame.awayTeam.id;
          else isTie = true;
        }

        await prisma.game.update({
          where: { id: localGame.id },
          data: { winnerId, isTie },
        });
        gamesSet++;
      }

      // ── 5. Check all games are resolved ─────────────────────────────────────
      const remaining = await prisma.game.count({
        where: { weekId: week.id, winnerId: null, isTie: false },
      });

      if (remaining > 0) {
        const detail = `${gamesSet} winner(s) set from ESPN; ${remaining} game(s) still unresolved — manual entry required`;
        results.push({ leagueId, status: "partial", detail });
        await logAdminAction("auto-results", "AUTO_RESULTS_PARTIAL", {
          leagueId,
          weekId: week.id,
          weekLabel: week.label,
          gamesSet,
          remaining,
        });
        continue;
      }

      // ── 6. Confirm the week ──────────────────────────────────────────────────
      const { picksGraded } = await confirmWeek(week.id, "auto-results");

      // ── 7. Advance to next week if configured ────────────────────────────────
      let advancedToWeekId: string | undefined;
      if (autoResultsAdvanceWeek) {
        const nextWeek = await prisma.week.findFirst({
          where: { seasonId: week.seasonId, number: week.number + 1 },
          select: { id: true, number: true, label: true },
        });

        if (nextWeek) {
          await prisma.$transaction([
            prisma.week.update({ where: { id: week.id }, data: { isCurrent: false } }),
            prisma.week.update({ where: { id: nextWeek.id }, data: { isCurrent: true, lockedForSubmission: false } }),
          ]);

          // Keep league test-week pointer in sync if the league is in test mode
          await prisma.leagueSettings.updateMany({
            where: { leagueId, mode: "test" },
            data: { testWeekId: nextWeek.id },
          });

          advancedToWeekId = nextWeek.id;
        }
      }

      // ── 8. Log success ───────────────────────────────────────────────────────
      const detail = `Confirmed ${week.label} (${picksGraded} picks graded)` +
        (advancedToWeekId ? `; advanced to week ${week.number + 1}` : "");

      await logAdminAction("auto-results", "AUTO_RESULTS", {
        leagueId,
        weekId: week.id,
        weekLabel: week.label,
        seasonYear: week.season.year,
        picksGraded,
        advancedToWeekId,
      });

      results.push({ leagueId, status: "processed", detail });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ leagueId, status: "error", detail: msg });
      await logAdminAction("auto-results", "AUTO_RESULTS_ERROR", { leagueId, error: msg }).catch(() => {});
    }
  }

  return NextResponse.json({ processed: now.toISOString(), results });
}
