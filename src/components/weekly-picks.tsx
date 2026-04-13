"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  espnId: string;
  teamRecords: TeamRecord[];
}

interface Game {
  id: string;
  gameTime: string | null;
  homeTeam: Team;
  awayTeam: Team;
  winner: { id: string } | null;
}

interface Pick {
  gameId: string;
  pickedTeam: { id: string };
}

interface PickSet {
  id: string;
  submittedAt: string;
  lockedAt: string | null;
  picks: Pick[];
}

interface Week {
  id: string;
  number: number;
  label: string;
  season: { year: number };
}

function recordLabel(records: TeamRecord[]): string {
  const r = records[0];
  if (!r) return "0-0";
  return r.ties > 0 ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`;
}

function TeamButton({
  team,
  selected,
  locked,
  onClick,
}: {
  team: Team;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`;

  const base =
    "flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all";

  let style: string;
  if (locked) {
    style = selected
      ? `${base} border-green-500 bg-green-500/10`
      : `${base} border-zinc-700 bg-zinc-800/40 opacity-40`;
  } else {
    style = selected
      ? `${base} border-indigo-500 bg-indigo-500/10 cursor-pointer`
      : `${base} border-zinc-700 bg-zinc-800 hover:border-zinc-500 cursor-pointer`;
  }

  return (
    <button className={style} onClick={onClick} disabled={locked} type="button">
      <img
        src={logoUrl}
        alt={team.name}
        className="h-14 w-14 object-contain"
      />
      <span className="text-sm font-semibold text-zinc-100">{team.abbreviation}</span>
      <span className="text-xs text-zinc-400">{recordLabel(team.teamRecords)}</span>
    </button>
  );
}

export function WeeklyPicks() {
  const [week, setWeek] = useState<Week | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [pickSet, setPickSet] = useState<PickSet | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/picks");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.error ?? `Server error (${res.status})`);
        setLoading(false);
        return;
      }
    setWeek(data.week);
    setGames(data.games);
    setPickSet(data.pickSet ?? null);

    // Pre-populate selections from existing picks (only if unlocked)
    if (data.pickSet && !data.pickSet.lockedAt) {
      const existing: Record<string, string> = {};
      for (const p of data.pickSet.picks) {
        existing[p.gameId] = p.pickedTeam.id;
      }
      setSelections(existing);
    } else if (data.pickSet?.lockedAt) {
      // Locked: still load picks so they display correctly
      const existing: Record<string, string> = {};
      for (const p of data.pickSet.picks) {
        existing[p.gameId] = p.pickedTeam.id;
      }
      setSelections(existing);
    }

      setLoading(false);
    } catch (err) {
      setError("Failed to load picks. Please refresh the page.");
      setLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const picks = Object.entries(selections).map(([gameId, pickedTeamId]) => ({
      gameId,
      pickedTeamId,
    }));
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to submit picks");
    } else {
      await fetchData();
    }
    setSubmitting(false);
  }

  const isLocked = !!pickSet?.lockedAt;
  const allPicked = games.length > 0 && Object.keys(selections).length === games.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!week || games.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950">
        <header className="border-b border-zinc-800 bg-zinc-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold text-zinc-50">Weekly Picks</h1>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
              Dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-10">
          <p className="text-zinc-400">No games scheduled for the current week.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">Weekly Picks</h1>
            <p className="text-sm text-zinc-400">
              {week.season.year} · {week.label}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* Status banner */}
        {isLocked ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/20 px-4 py-3">
            <span className="inline-flex rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              Locked
            </span>
            <span className="text-sm text-green-300">
              Your picks are submitted and locked. Contact the admin to make changes.
            </span>
          </div>
        ) : pickSet ? (
          <div className="mb-6 rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3">
            <span className="text-sm text-yellow-300">
              Your picks have been unlocked by an admin. Update and resubmit below.
            </span>
          </div>
        ) : null}

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Game cards */}
        <div className="space-y-4">
          {games.map((game) => {
            const selectedTeamId = selections[game.id];
            return (
              <div
                key={game.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                {game.gameTime && (
                  <p className="mb-3 text-center text-xs text-zinc-500">
                    {new Date(game.gameTime).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                <div className="flex gap-3">
                  <TeamButton
                    team={game.awayTeam}
                    selected={selectedTeamId === game.awayTeam.id}
                    locked={isLocked}
                    onClick={() =>
                      setSelections((s) => ({ ...s, [game.id]: game.awayTeam.id }))
                    }
                  />
                  <div className="flex items-center text-sm font-bold text-zinc-500">@</div>
                  <TeamButton
                    team={game.homeTeam}
                    selected={selectedTeamId === game.homeTeam.id}
                    locked={isLocked}
                    onClick={() =>
                      setSelections((s) => ({ ...s, [game.id]: game.homeTeam.id }))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        {!isLocked && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!allPicked || submitting}
              className="rounded-lg bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Picks"}
            </button>
            {!allPicked && (
              <p className="text-xs text-zinc-500">
                {games.length - Object.keys(selections).length} game
                {games.length - Object.keys(selections).length !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
