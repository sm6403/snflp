"use client";

import { useEffect, useState } from "react";
import { SeasonLeaderboard } from "@/components/season-leaderboard";
import { WeeklyLeaderboard } from "@/components/weekly-leaderboard";
import type { ChartSeries } from "@/components/leaderboard-chart";

type Tab = "season" | "weekly";

export interface ChartHistory {
  confirmedWeeks: Array<{ weekId: string; weekNumber: number; weekLabel: string }>;
  users: Array<{
    userId: string;
    displayName: string;
    weeklyRanks: (number | null)[];
    seasonRanks: (number | null)[];
  }>;
  currentUserId: string;
  totalPlayers: number;
}

function toSeasonSeries(history: ChartHistory): ChartSeries[] {
  return history.users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    ranks: u.seasonRanks,
  }));
}

function toWeeklySeries(history: ChartHistory): ChartSeries[] {
  return history.users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    ranks: u.weeklyRanks,
  }));
}

export function LeaderboardTabs({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("season");
  const [chartHistory, setChartHistory] = useState<ChartHistory | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard/chart-history")
      .then((r) => r.json())
      .then((d: ChartHistory) => setChartHistory(d))
      .catch(() => {});
  }, []);

  const chartWeeks =
    chartHistory?.confirmedWeeks.map((w) => ({
      weekNumber: w.weekNumber,
      weekLabel: w.weekLabel,
    })) ?? [];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("season")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "season"
              ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Season
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "weekly"
              ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Weekly
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "season" ? (
        <SeasonLeaderboard
          userId={userId}
          chartWeeks={chartWeeks}
          chartSeries={chartHistory ? toSeasonSeries(chartHistory) : []}
          totalPlayers={chartHistory?.totalPlayers ?? 1}
        />
      ) : (
        <WeeklyLeaderboard
          userId={userId}
          chartWeeks={chartWeeks}
          chartSeries={chartHistory ? toWeeklySeries(chartHistory) : []}
          totalPlayers={chartHistory?.totalPlayers ?? 1}
        />
      )}
    </div>
  );
}
