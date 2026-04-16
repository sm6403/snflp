import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAutoLockState, type AutoLockMode } from "@/lib/auto-lock-utils";
import { createMissedPicksForLockedGames } from "@/lib/auto-lock-picks";

// GET /api/cron/auto-lock
// Called on a schedule. Locks weeks and/or individual games based on:
//   1. Week.lockAt (existing scheduled lock)
//   2. LeagueSettings.autoLockMode (game-time-based lock)
// Protected by CRON_SECRET env var (passed as ?secret=... or Authorization header).
export async function GET(request: Request) {
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
  const results: {
    weekLocks: { id: string; label: string; lockAt: Date | null }[];
    gameLocks: { leagueId: string; mode: string; earlyLocked: number; mainLocked: number; weekLocked: boolean }[];
  } = { weekLocks: [], gameLocks: [] };

  // ── Phase 1: Existing week-level lockAt logic (unchanged) ──────────────────
  const weeksToLock = await prisma.week.findMany({
    where: {
      lockAt: { lte: now },
      lockedForSubmission: false,
    },
    select: { id: true, label: true, lockAt: true },
  });

  if (weeksToLock.length > 0) {
    await prisma.week.updateMany({
      where: { id: { in: weeksToLock.map((w) => w.id) } },
      data: { lockedForSubmission: true },
    });
    results.weekLocks = weeksToLock;
  }

  // ── Phase 2: Game-time-based auto-lock ─────────────────────────────────────
  const leaguesWithAutoLock = await prisma.leagueSettings.findMany({
    where: { autoLockMode: { not: "off" } },
    select: { leagueId: true, autoLockMode: true },
  });

  for (const ls of leaguesWithAutoLock) {
    const mode = ls.autoLockMode as AutoLockMode;
    if (mode === "off") continue;

    // Find current week for this league
    const week = await prisma.week.findFirst({
      where: {
        isCurrent: true,
        season: { leagueId: ls.leagueId, isCurrent: true },
      },
      select: { id: true, lockedForSubmission: true, lockAt: true },
    });

    if (!week) continue;
    // Skip if week is already fully locked
    if (week.lockedForSubmission) continue;
    // Skip if manual lockAt is set (manual takes precedence)
    if (week.lockAt) continue;

    // Fetch games with times
    const games = await prisma.game.findMany({
      where: { weekId: week.id },
      select: { id: true, gameTime: true, lockedAt: true },
    });

    const lockState = computeAutoLockState(
      games.map((g) => ({ id: g.id, gameTime: g.gameTime })),
      mode
    );

    const leagueResult = { leagueId: ls.leagueId, mode, earlyLocked: 0, mainLocked: 0, weekLocked: false };

    if (mode === "all_before_first") {
      // Lock all games + week when main lock time passes
      if (lockState.mainLockTime && now >= lockState.mainLockTime) {
        const unlocked = games.filter((g) => !g.lockedAt);
        if (unlocked.length > 0) {
          await prisma.game.updateMany({
            where: { id: { in: unlocked.map((g) => g.id) }, lockedAt: null },
            data: { lockedAt: now },
          });
          leagueResult.mainLocked = unlocked.length;
        }
        await prisma.week.update({
          where: { id: week.id },
          data: { lockedForSubmission: true },
        });
        leagueResult.weekLocked = true;
        // Create missed picks for all locked games
        await createMissedPicksForLockedGames(week.id, games.map((g) => g.id), ls.leagueId);
      }
    } else if (mode === "thursday_split") {
      // Lock early games when early lock time passes
      if (lockState.earlyLockTime && now >= lockState.earlyLockTime) {
        const earlyUnlocked = games.filter(
          (g) => lockState.earlyGameIds.includes(g.id) && !g.lockedAt
        );
        if (earlyUnlocked.length > 0) {
          await prisma.game.updateMany({
            where: { id: { in: earlyUnlocked.map((g) => g.id) }, lockedAt: null },
            data: { lockedAt: now },
          });
          leagueResult.earlyLocked = earlyUnlocked.length;
          // Create missed picks only for early games
          await createMissedPicksForLockedGames(week.id, earlyUnlocked.map((g) => g.id), ls.leagueId);
        }
      }

      // Lock main games + week when main lock time passes
      if (lockState.mainLockTime && now >= lockState.mainLockTime) {
        const mainUnlocked = games.filter(
          (g) => lockState.mainGameIds.includes(g.id) && !g.lockedAt
        );
        if (mainUnlocked.length > 0) {
          await prisma.game.updateMany({
            where: { id: { in: mainUnlocked.map((g) => g.id) }, lockedAt: null },
            data: { lockedAt: now },
          });
          leagueResult.mainLocked = mainUnlocked.length;
        }
        await prisma.week.update({
          where: { id: week.id },
          data: { lockedForSubmission: true },
        });
        leagueResult.weekLocked = true;
        // Create missed picks for any remaining unlocked games
        await createMissedPicksForLockedGames(week.id, games.map((g) => g.id), ls.leagueId);
      }
    }

    if (leagueResult.earlyLocked > 0 || leagueResult.mainLocked > 0 || leagueResult.weekLocked) {
      results.gameLocks.push(leagueResult);
    }
  }

  return NextResponse.json({
    locked: results.weekLocks.length,
    weeks: results.weekLocks.map((w) => ({ id: w.id, label: w.label, lockAt: w.lockAt })),
    gameLocks: results.gameLocks,
  });
}
