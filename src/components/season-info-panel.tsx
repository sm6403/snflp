"use client";

import { useState } from "react";
import { PositionCharts } from "@/components/position-charts";

interface SeasonStats {
  totalCorrect: number;
  totalWrong: number;
  totalGraded: number;
  weeksEntered: number;
  overallPct: number | null;
  bestWeekLabel: string;
  bestWeekCorrect: number;
  bestWeekGraded: number;
  bestPct: number | null;
}

interface Props {
  seasonYear: number;
  seasonLabel: string;
  stats: SeasonStats | null;
  hasAnyStats: boolean;
  timedAutolocking: boolean;
  ruleFavouriteTeamBonusWin: boolean;
  ruleLMS: boolean;
}

export function SeasonInfoPanel({
  seasonYear,
  seasonLabel,
  stats,
  hasAnyStats,
  timedAutolocking,
  ruleFavouriteTeamBonusWin,
  ruleLMS,
}: Props) {
  const [tab, setTab] = useState<"stats" | "rules">("stats");

  const activeRuleCount = [timedAutolocking, ruleFavouriteTeamBonusWin, ruleLMS].filter(Boolean).length;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-zinc-200 px-6 dark:border-zinc-800">
        <button
          onClick={() => setTab("stats")}
          className={`relative py-3 pr-4 text-sm font-medium transition-colors ${
            tab === "stats"
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {seasonYear} Season Stats
          {tab === "stats" && (
            <span className="absolute bottom-0 left-0 right-4 h-0.5 rounded-full bg-indigo-500" />
          )}
        </button>
        <button
          onClick={() => setTab("rules")}
          className={`relative py-3 pl-4 text-sm font-medium transition-colors ${
            tab === "rules"
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Season Rules
          {activeRuleCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
              {activeRuleCount}
            </span>
          )}
          {tab === "rules" && (
            <span className="absolute bottom-0 left-4 right-0 h-0.5 rounded-full bg-indigo-500" />
          )}
        </button>
      </div>

      <div className="p-6">
        {/* ── Stats tab ── */}
        {tab === "stats" && (
          <>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {seasonLabel}
            </p>

            {hasAnyStats && stats ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Correct
                  </p>
                  <p className="mt-1 text-3xl font-bold text-green-500">
                    {stats.totalCorrect}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Wrong
                  </p>
                  <p className="mt-1 text-3xl font-bold text-red-500">
                    {stats.totalWrong}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Overall
                  </p>
                  <p className={`mt-1 text-3xl font-bold ${
                    (stats.overallPct ?? 0) >= 70
                      ? "text-green-500"
                      : (stats.overallPct ?? 0) >= 50
                      ? "text-yellow-500"
                      : "text-red-500"
                  }`}>
                    {stats.overallPct ?? 0}%
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {stats.totalCorrect}/{stats.totalGraded} graded
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Best Week
                  </p>
                  {stats.bestPct !== null ? (
                    <>
                      <p className="mt-1 text-3xl font-bold text-indigo-500">
                        {stats.bestPct}%
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {stats.bestWeekLabel} · {stats.bestWeekCorrect}/{stats.bestWeekGraded}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-400">—</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
                No graded results yet — your stats will appear once the admin confirms game results.
              </p>
            )}

            {hasAnyStats && stats && (
              <>
                <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Based on {stats.weeksEntered} week{stats.weeksEntered !== 1 ? "s" : ""} entered
                  · {stats.totalGraded} pick{stats.totalGraded !== 1 ? "s" : ""} graded
                </p>
                <PositionCharts />
              </>
            )}
          </>
        )}

        {/* ── Rules tab ── */}
        {tab === "rules" && (
          <div className="space-y-3">
            {activeRuleCount === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No custom rules are active for this season.
              </p>
            ) : (
              <>
                {ruleFavouriteTeamBonusWin && (
                  <div className="flex items-start gap-3 rounded-lg border border-purple-700/40 bg-purple-500/5 px-4 py-3">
                    <span className="mt-0.5 text-lg leading-none">⭐</span>
                    <div>
                      <p className="text-sm font-semibold text-purple-300">
                        Favourite Team Bonus Win
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Your pick for your favourite team always counts as correct, even if they lose.
                        Bonus wins are highlighted in purple on your results page.
                      </p>
                    </div>
                  </div>
                )}

                {timedAutolocking && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-500/5 px-4 py-3">
                    <span className="mt-0.5 text-lg leading-none">⏰</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-300">
                        Timed Game Locking
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Individual games lock automatically at kickoff. You can still submit picks
                        for any game that hasn&apos;t started yet — locked games cannot be changed.
                      </p>
                    </div>
                  </div>
                )}

                {ruleLMS && (
                  <div className="flex items-start gap-3 rounded-lg border border-purple-700/40 bg-purple-500/5 px-4 py-3">
                    <span className="mt-0.5 text-lg leading-none">⚔️</span>
                    <div>
                      <p className="text-sm font-semibold text-purple-300">
                        Last Man Standing
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Each week you pick one team to win. If your team loses (or ties), you are
                        eliminated. You cannot reuse a team across the season — teams on a BYE
                        cannot be picked. Check the LMS tab on the leaderboard to see who&apos;s still standing.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
