"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface WeekSlot {
  id: string | null;
  number: number;
  label: string;
  lockedForSubmission: boolean;
  confirmedAt: string | null;
  pickSet: { correct: number; graded: number; total: number } | null;
}

interface SeasonData {
  id: string;
  year: number;
}

function ScoreBadge({ correct, graded }: { correct: number; graded: number }) {
  if (graded === 0) return null;
  const pct = Math.round((correct / graded) * 100);
  const colour =
    pct >= 70
      ? "bg-green-600/20 text-green-400"
      : pct >= 50
      ? "bg-yellow-600/20 text-yellow-400"
      : "bg-red-600/20 text-red-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colour}`}>
      {pct}%
    </span>
  );
}

export function WeekHistory() {
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [weeks, setWeeks] = useState<WeekSlot[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/picks/season")
      .then((r) => r.json())
      .then((data) => {
        setSeason(data.season ?? null);
        setWeeks(data.weeks ?? []);
        setCurrentWeekId(data.currentWeekId ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-400">Loading season history…</p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">No active season found.</p>
      </div>
    );
  }

  // Derive current week number so we can classify past/present/future
  const currentWeekNumber = weeks.find((w) => w.id === currentWeekId)?.number ?? null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {season.year} Season — Week by Week
        </h3>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {weeks.map((w) => {
          const ps = w.pickSet;
          const hasEntry = ps !== null;
          const hasGraded = ps && ps.graded > 0;
          const isCurrent = w.id !== null && w.id === currentWeekId;
          const isPast =
            currentWeekNumber !== null && w.number < currentWeekNumber;
          const isFuture =
            currentWeekNumber !== null && w.number > currentWeekNumber;

          return (
            <li
              key={w.number}
              className={`flex items-center justify-between px-6 py-3 ${
                isCurrent
                  ? "bg-indigo-50 dark:bg-indigo-900/20"
                  : isPast
                  ? "bg-zinc-50 dark:bg-zinc-950/40"
                  : ""
              }`}
            >
              {/* Left: week label + status pill + score */}
              <div className="flex min-w-0 items-center gap-3">
                {/* Week number + status badge */}
                <div className="flex w-28 flex-shrink-0 items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isCurrent
                        ? "text-indigo-700 dark:text-indigo-300"
                        : isPast
                        ? "text-zinc-500 dark:text-zinc-400"
                        : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {w.label}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Now
                    </span>
                  )}
                  {isPast && (
                    <span className="inline-flex rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                      Final
                    </span>
                  )}
                </div>

                {/* Score / status text */}
                {hasEntry ? (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {hasGraded ? (
                      <>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                          {ps.correct}/{ps.graded}
                        </span>
                        {" "}correct
                        {ps.total > ps.graded && (
                          <span className="ml-1 text-xs text-zinc-500">
                            ({ps.total - ps.graded} pending)
                          </span>
                        )}
                      </>
                    ) : !w.confirmedAt ? (
                      <span className="text-zinc-500">Submitted — awaiting confirmation</span>
                    ) : (
                      <span className="text-zinc-500">Submitted — awaiting results</span>
                    )}
                  </span>
                ) : isFuture ? null : (
                  <span className="text-sm text-zinc-400 dark:text-zinc-600">
                    {isPast ? "No picks entered" : "0/0"}
                  </span>
                )}

                {hasGraded && <ScoreBadge correct={ps.correct} graded={ps.graded} />}
              </div>

              {/* Right: action link */}
              <div className="ml-4 flex-shrink-0">
                {w.id && isCurrent ? (
                  <Link
                    href="/picks"
                    className="rounded-md px-3 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                  >
                    Pick Now →
                  </Link>
                ) : w.id && isPast ? (
                  <Link
                    href={`/picks/${w.id}`}
                    className="rounded-md px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    View Results →
                  </Link>
                ) : w.id && !isFuture ? (
                  <Link
                    href={`/picks/${w.id}`}
                    className="rounded-md px-3 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                  >
                    View Picks →
                  </Link>
                ) : w.id && isFuture ? (
                  <span className="text-xs text-zinc-500">Upcoming</span>
                ) : (
                  <span className="text-xs text-zinc-500">Not yet scheduled</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
