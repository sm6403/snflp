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

interface FormEntry {
  result: "win" | "loss" | "tie" | "bye";
  weekNumber: number;
  opponentEspnId?: string;
  opponentAbbr?: string;
}

interface Game {
  id: string;
  gameTime: string | null;
  homeTeam: Team;
  awayTeam: Team;
  winner: { id: string } | null;
  isTie?: boolean;
  isTimeLocked?: boolean;
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
  if (!r) return "0-0-0";
  return `${r.wins}-${r.losses}-${r.ties}`;
}

// ─── Form Strip ───────────────────────────────────────────────────────────────

function FormStrip({
  form,
  position,
  compact = false,
}: {
  form: FormEntry[];
  position: "left" | "right";
  compact?: boolean;
}) {
  if (!form || form.length === 0) return null;

  const size = compact ? "h-5 w-5" : "h-7 w-7";
  const gap = compact ? "gap-1" : "gap-1.5";
  const direction = compact ? "flex-row" : "flex-col";
  const margin = compact
    ? position === "left" ? "mr-1.5" : "ml-1.5"
    : position === "left" ? "mr-1" : "ml-1";

  return (
    <div className={`flex ${direction} items-center ${gap} self-center flex-shrink-0 ${margin}`}>
      {form.map((entry, i) => {
        const weekLabel = `Week ${entry.weekNumber}`;
        if (entry.result === "bye") {
          return (
            <div
              key={i}
              title={weekLabel}
              className={`flex ${size} items-center justify-center rounded-full bg-zinc-700 flex-shrink-0`}
            >
              <span className="text-[6px] font-bold leading-none text-zinc-400">BYE</span>
            </div>
          );
        }
        const borderColor =
          entry.result === "win"
            ? "border-green-500"
            : entry.result === "loss"
            ? "border-red-500"
            : "border-yellow-500";
        const oppLogoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${entry.opponentEspnId}.png`;
        return (
          <div
            key={i}
            title={weekLabel}
            className={`${size} flex-shrink-0 overflow-hidden rounded-full border-2 bg-zinc-800 ${borderColor}`}
          >
            <img
              src={oppLogoUrl}
              alt={entry.opponentAbbr ?? ""}
              className="h-full w-full object-contain p-0.5"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Team Button ──────────────────────────────────────────────────────────────

function TeamButton({
  team,
  selected,
  locked,
  isWinner,
  isTie,
  isCorrectPick,
  isFavoritePreselect,
  isResultsView,
  recentForm,
  formPosition,
  compact = false,
  onClick,
}: {
  team: Team;
  selected: boolean;
  locked: boolean;
  isWinner: boolean | null;
  isTie: boolean;
  isCorrectPick: boolean | null;
  isFavoritePreselect: boolean;
  isResultsView: boolean;
  recentForm?: FormEntry[];
  formPosition?: "left" | "right";
  compact?: boolean;
  onClick: () => void;
}) {
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`;
  const hasResult = isWinner !== null;

  // Border/bg style — same logic for both layouts
  let borderBg: string;
  if (hasResult && isTie) {
    borderBg = "border-amber-500 bg-amber-500/10";
  } else if (isWinner === true) {
    borderBg = "border-green-500 bg-green-500/10";
  } else if (isWinner === false && selected) {
    borderBg = "border-red-500 bg-red-500/10";
  } else if (isWinner === false) {
    borderBg = "border-zinc-700 bg-zinc-800/40 opacity-40";
  } else if (isResultsView) {
    borderBg = "border-zinc-700 bg-zinc-800/60 opacity-60";
  } else if (locked) {
    borderBg = selected
      ? "border-green-500 bg-green-500/10"
      : "border-zinc-700 bg-zinc-800/40 opacity-40";
  } else if (selected && isFavoritePreselect) {
    borderBg = "border-yellow-400 bg-yellow-400/10 cursor-pointer";
  } else {
    borderBg = selected
      ? "border-indigo-500 bg-indigo-500/10 cursor-pointer"
      : "border-zinc-700 bg-zinc-800 hover:border-zinc-500 cursor-pointer";
  }

  // ── Compact layout ──────────────────────────────────────────────────────────
  if (compact) {
    const base = `flex flex-1 items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 transition-all ${borderBg}`;

    // Small result dot shown after abbreviation
    let resultDot: React.ReactNode = null;
    if (hasResult && isTie) {
      resultDot = <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" title="Draw" />;
    } else if (!isTie && isWinner === true) {
      resultDot = <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" title="Winner" />;
    } else if (!isTie && isCorrectPick === true && selected) {
      resultDot = <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" title="Correct" />;
    } else if (!isTie && isCorrectPick === false && selected) {
      resultDot = <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" title="Wrong" />;
    } else if (selected && isFavoritePreselect && !locked && !isResultsView) {
      resultDot = <span className="text-[10px] leading-none" title="Favourite">⭐</span>;
    }

    const inner = (
      <>
        <img src={logoUrl} alt={team.name} className="h-7 w-7 flex-shrink-0 object-contain" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-zinc-100">{team.abbreviation}</span>
            {resultDot}
          </div>
          <span className="text-[10px] leading-tight text-zinc-500">{recordLabel(team.teamRecords)}</span>
        </div>
      </>
    );

    return (
      <button className={base} onClick={onClick} disabled={locked || isResultsView} type="button">
        {formPosition === "left" && recentForm && recentForm.length > 0 && (
          <FormStrip form={recentForm} position="left" compact />
        )}
        {inner}
        {formPosition === "right" && recentForm && recentForm.length > 0 && (
          <FormStrip form={recentForm} position="right" compact />
        )}
      </button>
    );
  }

  // ── Full layout ─────────────────────────────────────────────────────────────
  const base = `flex flex-1 items-center rounded-xl border-2 p-4 transition-all ${borderBg}`;

  const mainContent = (
    <div className="flex flex-1 flex-col items-center gap-2">
      <img src={logoUrl} alt={team.name} className="h-14 w-14 object-contain" />
      <span className="text-sm font-semibold text-zinc-100">{team.abbreviation}</span>
      <span className="text-xs text-zinc-400">{recordLabel(team.teamRecords)}</span>

      {hasResult && isTie && (
        <span className="text-xs font-semibold text-amber-400">Draw</span>
      )}
      {!isTie && isWinner === true && (
        <span className="text-xs font-semibold text-green-400">✓ Winner</span>
      )}
      {!isTie && isCorrectPick === true && selected && (
        <span className="text-xs font-semibold text-green-400">✓ Correct</span>
      )}
      {!isTie && isCorrectPick === false && selected && (
        <span className="text-xs font-semibold text-red-400">✗ Wrong</span>
      )}
      {selected && isFavoritePreselect && !locked && !isResultsView && (
        <span className="text-xs font-semibold text-yellow-400">⭐ Favourite</span>
      )}
    </div>
  );

  return (
    <button className={base} onClick={onClick} disabled={locked || isResultsView} type="button">
      {formPosition === "left" && recentForm && recentForm.length > 0 && (
        <FormStrip form={recentForm} position="left" />
      )}
      {mainContent}
      {formPosition === "right" && recentForm && recentForm.length > 0 && (
        <FormStrip form={recentForm} position="right" />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [timedAutolocking, setTimedAutolocking] = useState(false);
  const [teamForm, setTeamForm] = useState<Record<string, FormEntry[]>>({});
  const [compact, setCompact] = useState(false);

  // Restore compact preference from localStorage on mount
  useEffect(() => {
    try {
      setCompact(localStorage.getItem("picks-compact") === "true");
    } catch {}
  }, []);

  function toggleCompact() {
    setCompact((prev) => {
      const next = !prev;
      try { localStorage.setItem("picks-compact", String(next)); } catch {}
      return next;
    });
  }

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
      setTimedAutolocking(!!data.timedAutolocking);
      setTeamForm(data.teamForm ?? {});

      if (data.pickSet?.picks) {
        const existing: Record<string, string> = {};
        for (const p of data.pickSet.picks) {
          existing[p.gameId] = p.pickedTeam.id;
        }
        setSelections(existing);
        setFavoriteSelections(new Set());
      } else if (!isHistorical && !data.isViewingOther && data.favoriteTeamId && data.games?.length) {
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
  const timeLockedGames = games.filter((g) => !!g.isTimeLocked);
  const pickableGames = games.filter((g) => !g.isTimeLocked);
  const allPicked = pickableGames.length > 0 && pickableGames.every((g) => !!selections[g.id]);
  const weekLockedNoSubmission = week?.lockedForSubmission && !pickSet;

  const gradedPicks = pickSet?.picks.filter((p) => p.isCorrect !== null) ?? [];
  const correctCount = gradedPicks.filter((p) => p.isCorrect === true).length;
  const hasResults = gradedPicks.length > 0;
  const scorePct = gradedPicks.length > 0 ? Math.round((correctCount / gradedPicks.length) * 100) : 0;

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
          <div className="flex items-center gap-3">
            {/* Compact toggle */}
            <button
              onClick={toggleCompact}
              title={compact ? "Switch to full view" : "Switch to compact view"}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                compact
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {/* Two-lines icon for compact, full-card icon for expanded */}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                {compact ? (
                  // Wider spaced lines = expanded view
                  <>
                    <rect x="1" y="2" width="14" height="4" rx="1" />
                    <rect x="1" y="10" width="14" height="4" rx="1" />
                  </>
                ) : (
                  // Tight lines = compact view
                  <>
                    <line x1="1" y1="3" x2="15" y2="3" />
                    <line x1="1" y1="7" x2="15" y2="7" />
                    <line x1="1" y1="11" x2="15" y2="11" />
                    <line x1="1" y1="15" x2="15" y2="15" />
                  </>
                )}
              </svg>
              {compact ? "Full" : "Compact"}
            </button>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
              Dashboard
            </Link>
          </div>
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

        {/* Score summary */}
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
        <div className={compact ? "space-y-1.5" : "space-y-4"}>
          {games.map((game) => {
            const selectedTeamId = selections[game.id];
            const userPick = pickSet?.picks.find((p) => p.gameId === game.id);
            const hasResult = game.winner !== null || !!game.isTie;
            const isFavGame = favoriteSelections.has(game.id);
            const noPickResultsView = isHistorical && !userPick && !hasResult;
            const withPickResultsView = isHistorical && !userPick && hasResult;
            const gameTimeLocked = !!game.isTimeLocked;

            const gameTimeStr = game.gameTime
              ? new Date(game.gameTime).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : null;

            if (compact) {
              // ── Compact row ──────────────────────────────────────────────
              return (
                <div
                  key={game.id}
                  className={`rounded-lg border px-3 py-1.5 ${
                    gameTimeLocked ? "border-amber-800/50 bg-zinc-900" : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TeamButton
                      team={game.awayTeam}
                      selected={selectedTeamId === game.awayTeam.id}
                      locked={isLocked || weekLockedNoSubmission || gameTimeLocked || false}
                      isWinner={hasResult ? (game.winner?.id === game.awayTeam.id || false) : null}
                      isTie={hasResult && !!game.isTie}
                      isCorrectPick={userPick?.isCorrect ?? null}
                      isFavoritePreselect={isFavGame && selectedTeamId === game.awayTeam.id}
                      isResultsView={noPickResultsView || withPickResultsView}
                      recentForm={teamForm[game.awayTeam.id]}
                      formPosition="right"
                      compact
                      onClick={() => handleTeamClick(game.id, game.awayTeam.id)}
                    />

                    <div className="flex flex-shrink-0 flex-col items-center gap-0.5">
                      <span className="text-xs font-bold text-zinc-500">@</span>
                      {gameTimeLocked && !isHistorical && (
                        <span className="text-[9px] font-semibold text-amber-500">⏰</span>
                      )}
                      {gameTimeStr && (
                        <span className="hidden text-[9px] text-zinc-600 sm:block">{gameTimeStr}</span>
                      )}
                    </div>

                    <TeamButton
                      team={game.homeTeam}
                      selected={selectedTeamId === game.homeTeam.id}
                      locked={isLocked || weekLockedNoSubmission || gameTimeLocked || false}
                      isWinner={hasResult ? (game.winner?.id === game.homeTeam.id || false) : null}
                      isTie={hasResult && !!game.isTie}
                      isCorrectPick={userPick?.isCorrect ?? null}
                      isFavoritePreselect={isFavGame && selectedTeamId === game.homeTeam.id}
                      isResultsView={noPickResultsView || withPickResultsView}
                      recentForm={teamForm[game.homeTeam.id]}
                      formPosition="left"
                      compact
                      onClick={() => handleTeamClick(game.id, game.homeTeam.id)}
                    />
                  </div>
                </div>
              );
            }

            // ── Full card ──────────────────────────────────────────────────
            return (
              <div key={game.id} className={`rounded-xl border p-4 ${gameTimeLocked ? "border-amber-800/50 bg-zinc-900" : "border-zinc-800 bg-zinc-900"}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  {gameTimeStr ? (
                    <p className="text-xs text-zinc-500">{gameTimeStr}</p>
                  ) : <span />}
                  {gameTimeLocked && !isHistorical && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      ⏰ Started
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <TeamButton
                    team={game.awayTeam}
                    selected={selectedTeamId === game.awayTeam.id}
                    locked={isLocked || weekLockedNoSubmission || gameTimeLocked || false}
                    isWinner={hasResult ? (game.winner?.id === game.awayTeam.id || false) : null}
                    isTie={hasResult && !!game.isTie}
                    isCorrectPick={userPick?.isCorrect ?? null}
                    isFavoritePreselect={isFavGame && selectedTeamId === game.awayTeam.id}
                    isResultsView={noPickResultsView || withPickResultsView}
                    recentForm={teamForm[game.awayTeam.id]}
                    formPosition="right"
                    onClick={() => handleTeamClick(game.id, game.awayTeam.id)}
                  />
                  <div className="flex items-center text-sm font-bold text-zinc-500">@</div>
                  <TeamButton
                    team={game.homeTeam}
                    selected={selectedTeamId === game.homeTeam.id}
                    locked={isLocked || weekLockedNoSubmission || gameTimeLocked || false}
                    isWinner={hasResult ? (game.winner?.id === game.homeTeam.id || false) : null}
                    isTie={hasResult && !!game.isTie}
                    isCorrectPick={userPick?.isCorrect ?? null}
                    isFavoritePreselect={isFavGame && selectedTeamId === game.homeTeam.id}
                    isResultsView={noPickResultsView || withPickResultsView}
                    recentForm={teamForm[game.homeTeam.id]}
                    formPosition="left"
                    onClick={() => handleTeamClick(game.id, game.homeTeam.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        {!isHistorical && !isViewingOther && !isLocked && !weekLockedNoSubmission && (
          <div className="mt-8 flex flex-col items-center gap-2">
            {timedAutolocking && timeLockedGames.length > 0 && (
              <p className="text-xs text-amber-500">
                {timeLockedGames.length} game{timeLockedGames.length !== 1 ? "s have" : " has"} already started and cannot be picked.
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!allPicked || submitting}
              className="rounded-lg bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Picks"}
            </button>
            {!allPicked && (
              <p className="text-xs text-zinc-500">
                {pickableGames.length - pickableGames.filter((g) => !!selections[g.id]).length} game
                {pickableGames.length - pickableGames.filter((g) => !!selections[g.id]).length !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        )}

        {/* Historical with no submission */}
        {isHistorical && !pickSet && anyGameHasResult && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center">
            <p className="text-sm text-zinc-500">You didn&apos;t submit picks for this week.</p>
          </div>
        )}
      </main>
    </div>
  );
}
