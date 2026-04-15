"use client";

import { useEffect, useState } from "react";

interface League {
  id: string;
  name: string;
  joinedAt: string;
}

export function LeagueSwitcher({ activeLeagueId }: { activeLeagueId?: string | null }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [current, setCurrent] = useState<string>(activeLeagueId ?? "");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/user/leagues")
      .then((r) => r.json())
      .then((data) => {
        if (data.leagues) {
          setLeagues(data.leagues);
          // If no active league set, default to first
          if (!current && data.leagues.length > 0) {
            setCurrent(data.leagues[0].id);
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSwitch(leagueId: string) {
    if (leagueId === current || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/user/set-league", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });
      if (res.ok) {
        setCurrent(leagueId);
        window.location.reload();
      }
    } finally {
      setSwitching(false);
    }
  }

  // 0 leagues — show nothing
  if (leagues.length === 0) return null;

  // 1 league — show badge
  if (leagues.length === 1) {
    return (
      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {leagues[0].name}
      </span>
    );
  }

  // 2+ leagues — show dropdown
  return (
    <select
      value={current}
      onChange={(e) => handleSwitch(e.target.value)}
      disabled={switching}
      className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {leagues.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
