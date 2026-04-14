import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { FavoriteTeamPicker } from "@/components/favorite-team-picker";
import { AliasEditor } from "@/components/alias-editor";
import { WeekHistory } from "@/components/week-history";
import { UserNav } from "@/components/user-nav";
import { getCurrentWeek } from "@/lib/nfl-data";
import { SeasonInfoPanel } from "@/components/season-info-panel";

// Force fresh DB read on every request so admin lock/unlock changes
// are reflected immediately without stale cache
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const [user, currentWeek] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favoriteTeam: true, favoriteTeamLocked: true, alias: true },
    }),
    getCurrentWeek(),
  ]);

  // Fetch the user's pick set for the current week (for status pill)
  const currentPickSet = currentWeek
    ? await prisma.pickSet.findUnique({
        where: { userId_weekId: { userId: session.user.id, weekId: currentWeek.id } },
        select: { lockedAt: true, lockedBy: true },
      })
    : null;

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
            <UserNav active="dashboard" />
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
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  No active week right now.
                </p>
              )}
            </div>
            {currentWeek && (
              <Link
                href="/picks"
                className="flex-shrink-0 rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to Picks
              </Link>
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

        <AliasEditor initialAlias={user?.alias ?? ""} />
        <FavoriteTeamPicker
          initialTeam={user?.favoriteTeam ?? "Los Angeles Rams"}
          initialLocked={user?.favoriteTeamLocked ?? false}
        />
        <WeekHistory />
      </main>
    </div>
  );
}
