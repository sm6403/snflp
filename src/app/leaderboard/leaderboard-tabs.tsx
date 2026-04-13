"use client";

import { useState } from "react";
import { SeasonLeaderboard } from "@/components/season-leaderboard";
import { WeeklyLeaderboard } from "@/components/weekly-leaderboard";

type Tab = "season" | "weekly";

export function LeaderboardTabs({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("season");

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
        <SeasonLeaderboard userId={userId} />
      ) : (
        <WeeklyLeaderboard userId={userId} />
      )}
    </div>
  );
}
