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
  isCorrect: boolean | null;
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
  lockedForSubmission: boolean;
  confirmedAt: string | null;
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
  isWinner,
  isCorrectPick,
  isFavoritePreselect,
  isResultsView,
  onClick,
}: {
  team: Team;
  selected: boolean;
  locked: boolean;
  isWinner: boolean | null;
  isCorrectPick: boolean | null;
  isFavoritePreselect: boolean;
  /** In results view with no user pick, just show winner/loser without pick overlay */
  isResultsView: boolean;
  onClick: () => void;
}) {
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`;
  const base = "flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all";

  let style: string;

  if (isWinner === true) {
    style = `${base} border-green-500 bg-green-500/10`;
  } else if (isWinner === false) {
    style = `${base} border-zinc-700 bg-zinc-800/40 opacity-40`;
  } else if (isResultsView) {
    // No result entered yet — show both teams neutrally, non-interactive
    style = `${base} border-zinc-700 bg-zinc-800/60 opacity-60`;
  } else if (locked) {
    style = selected
      ? `${base} border-green-500 bg-green-500/10`
      : `${base} border-zinc-700 bg-zinc-800/40 opacity-40`;
  } else if (selected && isFavoritePreselect) {
    style = `${base} border-yellow-400 bg-yellow-400/10 cursor-pointer`;
  } else {
    style = selected
      ? `${base} border-indigo-500 bg-indigo-500/10 cursor-pointer`
      : `${base} border-zinc-700 bg-zinc-800 hover:border-zinc-500 cursor-pointer`;
  }

  return (
    <button className={style} onClick={onClick} disabled={locked || isResultsView} type="button">
      <img src={logoUrl} alt={team.name} className="h-14 w-14 object-contain" />
      <span className="text-sm font-semibold text-zinc-100">{team.abbreviation}</span>
      <span className="text-xs text-zinc-400">{recordLabel(team.teamRecords)}</span>
      {isWinner === true && (
        <span className="text-xs font-semibold text-green-400">✓ Winner</span>
      )}
      {selected && isFavoritePreselect && !locked && !isResultsView && (
        <span className="text-xs font-semibold text-yellow-400">⭐ Favourite</span>
      )}
      {isCorrectPick === true && selected && (
        <span className="text-xs font-semibold text-green-400">✓ Correct</span>
      )}
      {isCorrectPick === false && selected && (
        <span className="text-xs font-semibold text-red-400">✗ Wrong</span>
      )}
    </button>
  );
}

export function WeeklyPicks({ weekId, userId }: { weekId?: string; userId?: string }) {
  const [week, setWeek] = useState<Week | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [pickSet, setPickSet] = useState<PickSet | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [favoriteSelections, setFavoriteSelections] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  const [viewingUser, setViewingUser] = useState<{ alias: string | null; name: string | null } | null>(null);

  // Historical mode = viewing a specific past week via /picks/[weekId]
  const isHistorical = !!weekId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = weekId ? `/api/picks?weekId=${weekId}` : "/api/picks";
      if (userId) url += `&userId=${userId}`;
      const res = await fetch(url);
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
      setIsViewingOther(!!data.isViewingOther);
      setViewingUser(data.viewingUser ?? null);

      if (data.pickSet?.picks) {
        const existing: Record<string, string> = {};
        for (const p of data.pickSet.picks) {
          existing[p.gameId] = p.pickedTeam.id;
        }
        setSelections(existing);
        setFavoriteSelections(new Set());
      } else if (!isHistorical && !data.isViewingOther && data.favoriteTeamId && data.games?.length) {
        // Only auto-select favourite on the current week, not historical results pages or other user views
        const favId: string = data.favoriteTeamId;
        const autoSelections: Record<string, string> = {};
        const favGames = new Set<string>();
        for (const g of data.games as Game[]) {
          if (g.homeTeam.id === favId || g.awayTeam.id === favId) {
            autoSelections[g.id] = favId;
            favGames.add(g.id);
          }
        }
        setSelections(autoSelections);
        setFavoriteSelections(favGames);
      } else {
        setSelections({});
        setFavoriteSelections(new Set());
      }

      setLoading(false);
    } catch (err) {
      setError("Failed to load. Please refresh the page.");
      setLoading(false);
      console.error(err);
    }
  }, [weekId, userId, isHistorical]);

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

  function handleTeamClick(gameId: string, teamId: string) {
    setSelections((s) => ({ ...s, [gameId]: teamId }));
    setFavoriteSelections((prev) => {
      const next = new Set(prev);
      next.delete(gameId);
      return next;
    });
  }

  const isLocked = !!pickSet?.lockedAt;
  const allPicked = games.length > 0 && Object.keys(selections).length === games.length;
  const weekLockedNoSubmission = week?.lockedForSubmission && !pickSet;

  // Results data
  const gradedPicks = pickSet?.picks.filter((p) => p.isCorrect !== null) ?? [];
  const correctCount = gradedPicks.filter((p) => p.isCorrect === true).length;
  const hasResults = gradedPicks.length > 0;
  const scorePct = gradedPicks.length > 0 ? Math.round((correctCount / gradedPicks.length) * 100) : 0;

  // Historical mode — check if ANY game has a confirmed winner
  const anyGameHasResult = games.some((g) => g.winner !== null);
  const noResultsYet = isHistorical && !anyGameHasResult;

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
            <h1 className="text-lg font-semibold text-zinc-50">
              {isViewingOther && viewingUser
                ? `Results — ${viewingUser.alias ?? viewingUser.name ?? "Player"}`
                : isHistorical
                ? "Results"
                : "Weekly Picks"}
            </h1>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
              Dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-10">
          <p className="text-zinc-400">No games scheduled for this week.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">
              {isViewingOther && viewingUser
                ? `Results — ${viewingUser.alias ?? viewingUser.name ?? "Player"}`
                : isHistorical
                ? "Results"
                : "Weekly Picks"}
            </h1>
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

        {/* ── HISTORICAL MODE BANNERS ── */}
        {isHistorical && noResultsYet && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-600 bg-amber-900/20 px-4 py-4">
            <span className="mt-0.5 text-lg leading-none">⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">Waiting for admin to confirm results</p>
              <p className="mt-1 text-xs text-amber-400/70">
                The admin hasn&apos;t entered the game results for this week yet. Check back later.
              </p>
            </div>
          </div>
        )}

        {/* Score summary (historical or current — whenever there are graded picks) */}
        {hasResults && (
          <div className={`mb-6 rounded-lg border p-4 ${
            correctCount === gradedPicks.length
              ? "border-green-600 bg-green-900/20"
              : "border-indigo-700 bg-indigo-900/20"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">Your Score</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-50">
                  {correctCount} / {gradedPicks.length}
                  <span className="ml-2 text-base font-normal text-zinc-400">correct</span>
                </p>
              </div>
              <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
                scorePct >= 70 ? "bg-green-600/20 text-green-400" :
                scorePct >= 50 ? "bg-yellow-600/20 text-yellow-400" :
                "bg-red-600/20 text-red-400"
              }`}>
                {scorePct}%
              </div>
            </div>
            {gradedPicks.length < games.length && (
              <p className="mt-2 text-xs text-zinc-500">
                {games.length - gradedPicks.length} game{games.length - gradedPicks.length !== 1 ? "s" : ""} still pending results
              </p>
            )}
          </div>
        )}

        {/* ── CURRENT-WEEK-ONLY BANNERS ── */}
        {!isHistorical && (
          <>
            {isLocked && !hasResults ? (
              <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/20 px-4 py-3">
                <span className="inline-flex rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                  Locked
                </span>
                <span className="text-sm text-green-300">
                  Your picks are submitted and locked. Results will appear here once confirmed.
                </span>
              </div>
            ) : pickSet && !isLocked ? (
              <div className="mb-6 rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3">
                <span className="text-sm text-yellow-300">
                  Your picks have been unlocked by an admin. Update and resubmit below.
                </span>
              </div>
            ) : weekLockedNoSubmission ? (
              <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-4">
                <p className="text-sm font-medium text-zinc-300">Submissions closed</p>
                <p className="mt-1 text-xs text-zinc-500">
                  The deadline for this week&apos;s picks has passed.
                </p>
              </div>
            ) : null}
          </>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── GAME CARDS ── */}
        <div className="space-y-4">
          {games.map((game) => {
            const selectedTeamId = selections[game.id];
            const userPick = pickSet?.picks.find((p) => p.gameId === game.id);
            const hasResult = game.winner !== null;
            const isFavGame = favoriteSelections.has(game.id);

            // In historical mode with no user pick, show game results without pick overlay
            // When there's no result entered for this specific game in historical mode,
            // use isResultsView=true to render a neutral "pending" style
            const noPickResultsView = isHistorical && !userPick && !hasResult;
            const withPickResultsView = isHistorical && !userPick && hasResult;

            return (
              <div key={game.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
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
                    locked={isLocked || weekLockedNoSubmission || false}
                    isWinner={hasResult ? game.winner?.id === game.awayTeam.id : null}
                    isCorrectPick={userPick?.isCorrect ?? null}
                    isFavoritePreselect={isFavGame && selectedTeamId === game.awayTeam.id}
                    isResultsView={noPickResultsView || withPickResultsView}
                    onClick={() => handleTeamClick(game.id, game.awayTeam.id)}
                  />
                  <div className="flex items-center text-sm font-bold text-zinc-500">@</div>
                  <TeamButton
                    team={game.homeTeam}
                    selected={selectedTeamId === game.homeTeam.id}
                    locked={isLocked || weekLockedNoSubmission || false}
                    isWinner={hasResult ? game.winner?.id === game.homeTeam.id : null}
                    isCorrectPick={userPick?.isCorrect ?? null}
                    isFavoritePreselect={isFavGame && selectedTeamId === game.homeTeam.id}
                    isResultsView={noPickResultsView || withPickResultsView}
                    onClick={() => handleTeamClick(game.id, game.homeTeam.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit — current week only, not historical or viewing other user */}
        {!isHistorical && !isViewingOther && !isLocked && !weekLockedNoSubmission && (
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

        {/* Historical with no submission — just a quiet note */}
        {isHistorical && !pickSet && anyGameHasResult && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center">
            <p className="text-sm text-zinc-500">You didn&apos;t submit picks for this week.</p>
          </div>
        )}
      </main>
    </div>
  );
}
