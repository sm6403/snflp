"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaderboardMultiChart, type ChartSeries } from "@/components/leaderboard-chart";

interface WeekOption {
  id: string;
  number: number;
  label: string;
  confirmedAt: string;
}

interface WeekUser {
  userId: string;
  displayName: string;
  rank: number;
  correct: number;
  total: number;
  pct: number;
}

interface WeekData {
  week: { id: string; number: number; label: string };
  currentUserId: string;
  users: WeekUser[];
}

export function WeeklyLeaderboard({
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
  const router = useRouter();
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available confirmed weeks
  useEffect(() => {
    fetch("/api/leaderboard/weeks")
      .then((r) => r.json())
      .then((d) => {
        const w: WeekOption[] = d.weeks ?? [];
        setWeeks(w);
        if (w.length > 0) setSelectedWeekId(w[0].id);
        setLoadingWeeks(false);
      })
      .catch(() => {
        setError("Failed to load weeks");
        setLoadingWeeks(false);
      });
  }, []);

  // Load rankings whenever selected week changes
  useEffect(() => {
    if (!selectedWeekId) return;
    setLoadingData(true);
    setError(null);
    fetch(`/api/leaderboard/week/${selectedWeekId}`)
      .then((r) => r.json())
      .then((d) => {
        setWeekData(d);
        setLoadingData(false);
      })
      .catch(() => {
        setError("Failed to load week rankings");
        setLoadingData(false);
      });
  }, [selectedWeekId]);

  if (loadingWeeks) {
    return <p className="text-sm text-zinc-400">Loading weeks…</p>;
  }

  if (weeks.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No weeks have confirmed results yet.
      </p>
    );
  }

  return (
    <div>
      {/* Week selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Week
        </label>
        <select
          value={selectedWeekId ?? ""}
          onChange={(e) => setSelectedWeekId(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loadingData ? (
        <p className="text-sm text-zinc-400">Loading rankings…</p>
      ) : weekData && weekData.users.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  #
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Player
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Correct
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {weekData.users.map((u) => {
                const isMe = u.userId === userId;
                return (
                  <tr
                    key={u.userId}
                    onClick={() =>
                      router.push(
                        `/picks/${selectedWeekId}?userId=${u.userId}`
                      )
                    }
                    className={`cursor-pointer transition-colors ${
                      isMe
                        ? "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30"
                        : "bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">
                      {u.rank}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          isMe
                            ? "text-indigo-700 dark:text-indigo-300"
                            : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {u.displayName}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-indigo-500 dark:text-indigo-400">
                            (you)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {u.correct}/{u.total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          u.pct >= 70
                            ? "text-green-500"
                            : u.pct >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {u.pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-600">
            Click a row to view that player&apos;s picks
          </p>
        </div>
      ) : (
        weekData && (
          <p className="text-sm text-zinc-400">
            No submissions found for this week.
          </p>
        )
      )}

      {/* Weekly position history chart (all confirmed weeks, independent of selector) */}
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
