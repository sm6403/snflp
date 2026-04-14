"use client";

import { useEffect, useState } from "react";
import { getTeamLogoUrl } from "@/lib/nfl-teams";
import { LeaderboardMultiChart, type ChartSeries } from "@/components/leaderboard-chart";

interface LeaderboardUser {
  userId: string;
  displayName: string;
  favoriteTeam: string;
  rank: number;
  correct: number;
  graded: number;
  pct: number;
  positionChange: number | null;
  divisionName: string | null;
}

interface SeasonData {
  id: string;
  year: number;
  usesDivisions: boolean;
}

interface ApiResponse {
  season: SeasonData | null;
  mostRecentWeekLabel: string | null;
  currentUserId: string;
  users: LeaderboardUser[];
}

function PositionBadge({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-xs text-zinc-500">—</span>;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">
        ▲ {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-semibold text-red-400">
        ▼ {Math.abs(change)}
      </span>
    );
  }
  return <span className="inline-flex rounded-full bg-zinc-700/40 px-2 py-0.5 text-xs font-semibold text-zinc-500">—</span>;
}

// Re-rank users within their division (input is already overall-sorted)
function groupByDivision(users: LeaderboardUser[]): Array<{ division: string; users: (LeaderboardUser & { divisionRank: number })[] }> {
  const map = new Map<string, LeaderboardUser[]>();
  for (const u of users) {
    const key = u.divisionName ?? "SNFLP Division";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }
  return Array.from(map.entries()).map(([division, members]) => ({
    division,
    users: members.map((u, idx) => ({ ...u, divisionRank: idx + 1 })),
  }));
}

export function SeasonLeaderboard({
  userId,
  chartWeeks,
  chartSeries,
  totalPlayers,
}: {
  userId: string;
  chartWeeks: Array<{ weekNumber: number; weekLabel: string }>;
  chartSeries: ChartSeries[];
  totalPlayers: number;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overall" | "divisions">("overall");

  useEffect(() => {
    fetch("/api/leaderboard/season")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load leaderboard");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading season leaderboard…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!data?.season || data.users.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No results confirmed yet this season.
      </p>
    );
  }

  const usesDivisions = data.season.usesDivisions;

  function renderRow(u: LeaderboardUser, rank: number) {
    const isMe = u.userId === userId;
    return (
      <tr
        key={u.userId}
        className={`${isMe ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-white dark:bg-zinc-950"}`}
      >
        <td className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {u.favoriteTeam && (
              <img src={getTeamLogoUrl(u.favoriteTeam)} alt={u.favoriteTeam} className="h-6 w-6 flex-shrink-0 object-contain" />
            )}
            <span className={`font-medium ${isMe ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-900 dark:text-zinc-100"}`}>
              {u.displayName}
              {isMe && <span className="ml-1.5 text-xs text-indigo-500 dark:text-indigo-400">(you)</span>}
            </span>
            {usesDivisions && viewMode === "overall" && u.divisionName && (
              <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                {u.divisionName}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{u.correct}/{u.graded}</td>
        <td className="px-4 py-3 text-right">
          <span className={`font-semibold ${u.pct >= 70 ? "text-green-500" : u.pct >= 50 ? "text-yellow-500" : "text-red-500"}`}>
            {u.pct}%
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <PositionBadge change={u.positionChange} />
        </td>
      </tr>
    );
  }

  return (
    <div>
      {data.mostRecentWeekLabel && (
        <p className="mb-3 text-xs text-zinc-500">
          Through {data.mostRecentWeekLabel} · position change vs previous week
        </p>
      )}

      {/* Overall / Divisions toggle */}
      {usesDivisions && (
        <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800/50 w-fit">
          {(["overall", "divisions"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === mode
                  ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {mode === "overall" ? "Overall" : "By Division"}
            </button>
          ))}
        </div>
      )}

      {viewMode === "overall" || !usesDivisions ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Player</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Correct</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">%</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.users.map((u) => renderRow(u, u.rank))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {groupByDivision(data.users).map(({ division, users: divUsers }) => (
            <div key={division}>
              <h4 className="mb-2 text-sm font-semibold text-blue-400">🏆 {division}</h4>
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Player</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Correct</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">%</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {divUsers.map((u) => renderRow(u, u.divisionRank))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Position history chart */}
      {chartSeries.length > 0 && chartWeeks.length > 0 && (
        <LeaderboardMultiChart
          weeks={chartWeeks}
          series={chartSeries}
          currentUserId={userId}
          maxY={totalPlayers}
        />
      )}
    </div>
  );
}
