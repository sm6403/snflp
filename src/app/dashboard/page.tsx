import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { FavoriteTeamPicker } from "@/components/favorite-team-picker";
import { JoinLeagueForm } from "@/components/join-league-form";
import { WeekHistory } from "@/components/week-history";
import { UserNav } from "@/components/user-nav";
import { getCurrentWeek } from "@/lib/nfl-data";
import { resolveUserLeagueId } from "@/lib/league-context";
import { computeAutoLockState } from "@/lib/auto-lock-utils";
import { SeasonInfoPanel } from "@/components/season-info-panel";

// Force fresh DB read on every request so admin lock/unlock changes
// are reflected immediately without stale cache
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteTeam: true, favoriteTeamLocked: true, alias: true },
  });

  const leagueId = await resolveUserLeagueId(session.user.id);

  if (!leagueId) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">SNFLP</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{session.user.email}</span>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Welcome{session.user.name ? `, ${session.user.name}` : ""}!
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Join a league to start making your picks.
            </p>
          </div>
          <JoinLeagueForm />
          <FavoriteTeamPicker initialTeam={user?.favoriteTeam ?? "Los Angeles Rams"} initialLocked={user?.favoriteTeamLocked ?? false} />
        </main>
      </div>
    );
  }

  const currentWeek = await getCurrentWeek(leagueId);

  // Fetch the user's pick set for the current week (for status pill)
  const currentPickSet = currentWeek
    ? await prisma.pickSet.findUnique({
        where: { userId_weekId: { userId: session.user.id, weekId: currentWeek.id } },
        select: { lockedAt: true, lockedBy: true },
      })
    : null;

  // ── Lock label + Thursday locked flag ────────────────────────────────────────
  let lockLabel: string | null = null;
  // True when some (but not all) games are locked — shown regardless of autoLockMode
  // so it works for manual "Lock Thursday Night" button too
  const thursdayLocked =
    currentWeek && !currentWeek.lockedForSubmission
      ? (await prisma.game.count({
          where: { weekId: currentWeek.id, lockedAt: { not: null } },
        })) > 0
      : false;

  if (currentWeek && !currentWeek.lockedForSubmission) {
    const fmt = (d: Date) =>
      d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    const now = new Date();
    // Manual scheduled lock takes highest priority
    if (currentWeek.lockAt && currentWeek.lockAt > now) {
      lockLabel = `Locks ${fmt(currentWeek.lockAt)}`;
    } else {
      const ls = await prisma.leagueSettings.findUnique({ where: { leagueId } });
      const autoLockMode = ls?.autoLockMode ?? "off";
      if (autoLockMode !== "off") {
        const games = await prisma.game.findMany({
          where: { weekId: currentWeek.id },
          select: { id: true, gameTime: true },
        });
        const { earlyLockTime, mainLockTime } = computeAutoLockState(
          games,
          autoLockMode as "all_before_first" | "thursday_split"
        );
        if (autoLockMode === "thursday_split") {
          const earlyPast = earlyLockTime && earlyLockTime <= now;
          const mainPast = mainLockTime && mainLockTime <= now;
          if (!mainPast) {
            if (!earlyPast && earlyLockTime) {
              lockLabel = `Thursday picks lock ${fmt(earlyLockTime)}`;
            } else if (mainLockTime) {
              lockLabel = `Remaining picks lock ${fmt(mainLockTime)}`;
            }
          }
        } else if (autoLockMode === "all_before_first" && mainLockTime && mainLockTime > now) {
          lockLabel = `Locks ${fmt(mainLockTime)}`;
        }
      }
    }
  }

  type PickStatus = "waiting" | "locked" | "unlocked" | "closed";
  let pickStatus: PickStatus = "waiting";
  if (currentWeek?.lockedForSubmission && !currentPickSet) {
    pickStatus = "closed";
  } else if (currentPickSet?.lockedAt) {
    pickStatus = "locked";
  } else if (currentPickSet && !currentPickSet.lockedAt) {
    pickStatus = "unlocked";
  }

  // ── Season stats ────────────────────────────────────────────────────────────
  // Fetch every pick the user has submitted this season, grouped by week.
  const seasonStats = await (async () => {
    if (!currentWeek) return null;

    const seasonWeeks = await prisma.week.findMany({
      where: { seasonId: currentWeek.seasonId },
      select: { id: true, number: true, label: true, confirmedAt: true },
    });
    // Only count picks from weeks where results have been confirmed
    const confirmedWeekIds = seasonWeeks
      .filter((w) => w.confirmedAt !== null)
      .map((w) => w.id);

    const pickSets = await prisma.pickSet.findMany({
      where: { userId: session.user!.id, weekId: { in: confirmedWeekIds } },
      select: {
        weekId: true,
        picks: { select: { isCorrect: true } },
      },
    });

    let totalCorrect = 0;
    let totalWrong = 0;
    let totalGraded = 0;
    let weeksEntered = 0;

    let bestWeekPct = -1;
    let bestWeekLabel = "";
    let bestWeekCorrect = 0;
    let bestWeekGraded = 0;

    for (const ps of pickSets) {
      const graded = ps.picks.filter((p) => p.isCorrect !== null);
      const correct = graded.filter((p) => p.isCorrect === true).length;
      const wrong = graded.filter((p) => p.isCorrect === false).length;

      weeksEntered++;
      totalCorrect += correct;
      totalWrong += wrong;
      totalGraded += graded.length;

      if (graded.length > 0) {
        const pct = correct / graded.length;
        if (pct > bestWeekPct) {
          bestWeekPct = pct;
          bestWeekCorrect = correct;
          bestWeekGraded = graded.length;
          const weekInfo = seasonWeeks.find((w) => w.id === ps.weekId);
          bestWeekLabel = weekInfo?.label ?? "";
        }
      }
    }

    const overallPct =
      totalGraded > 0 ? Math.round((totalCorrect / totalGraded) * 100) : null;
    const bestPct =
      bestWeekPct >= 0 ? Math.round(bestWeekPct * 100) : null;

    return {
      totalCorrect,
      totalWrong,
      totalGraded,
      weeksEntered,
      overallPct,
      bestWeekLabel,
      bestWeekCorrect,
      bestWeekGraded,
      bestPct,
    };
  })();

  const hasAnyStats = seasonStats && seasonStats.totalGraded > 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              SNFLP
            </h1>
            <UserNav active="dashboard" activeLeagueId={leagueId} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Welcome{session.user.name ? `, ${session.user.name}` : ""}!
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are signed in. This is your protected dashboard.
          </p>
        </div>

        {/* Weekly Picks card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Weekly Picks
              </h3>
              {currentWeek ? (
                <>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {currentWeek.season.year} — {currentWeek.label}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {pickStatus === "waiting" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        Waiting for picks
                      </span>
                    )}
                    {pickStatus === "locked" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Picks submitted
                      </span>
                    )}
                    {pickStatus === "unlocked" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                        Unlocked — update needed
                      </span>
                    )}
                    {pickStatus === "closed" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/40 bg-zinc-700/30 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                        Submissions closed
                      </span>
                    )}
                  </div>
                  {lockLabel && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-400/80">
                      <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {lockLabel}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  No active week right now.
                </p>
              )}
            </div>
            {currentWeek && (
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <Link
                  href="/picks"
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Go to Picks
                </Link>
                {thursdayLocked && (
                  <span className="flex items-center gap-1 text-xs text-amber-400/80">
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Thursday picks locked
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Season Stats / Rules panel */}
        {currentWeek && (
          <SeasonInfoPanel
            seasonYear={currentWeek.season.year}
            seasonLabel={`${currentWeek.season.year} · ${currentWeek.label}`}
            stats={seasonStats}
            hasAnyStats={!!hasAnyStats}
            timedAutolocking={currentWeek.season.timedAutolocking}
            ruleFavouriteTeamBonusWin={currentWeek.season.ruleFavouriteTeamBonusWin}
            ruleLMS={currentWeek.season.ruleLMS}
          />
        )}

        <FavoriteTeamPicker
          initialTeam={user?.favoriteTeam ?? "Los Angeles Rams"}
          initialLocked={user?.favoriteTeamLocked ?? false}
        />
        <WeekHistory />
      </main>
    </div>
  );
}
