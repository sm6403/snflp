"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminHeader } from "./admin-header";

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  espnId: string;
}

interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  gameTime: string | null;
  winner: Team | null;
  isTie: boolean;
}

interface Pick {
  id: string;
  gameId: string;
  pickedTeam: Team;
  isCorrect: boolean | null;
  editedBy: string | null;
  game: Game;
}

interface PickSet {
  id: string;
  submittedAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  user: { id: string; name: string | null; email: string; alias: string | null; favoriteTeam: string };
  picks: Pick[];
}

interface LmsPick {
  teamId: string | null;
  eliminated: boolean;
  team: { id: string; name: string; abbreviation: string; espnId: string } | null;
}

interface WeekOption {
  id: string;
  number: number;
  label: string;
  season: { id: string; year: number };
}

interface Week {
  id: string;
  number: number;
  label: string;
  lockedForSubmission: boolean;
  lockAt: string | null;
  confirmedAt: string | null;
  season: { id: string; year: number };
}

// ─── Status badge ────────────────────────────────────────────────────────────

function statusBadge(ps: PickSet) {
  if (ps.lockedAt) {
    return (
      <span className="inline-flex rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
        Locked
      </span>
    );
  }
  if (ps.submittedAt) {
    return (
      <span className="inline-flex rounded-full bg-yellow-600/20 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
        Unlocked
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
      Pending
    </span>
  );
}

function scoreLabel(picks: Pick[]) {
  const graded = picks.filter((p) => p.isCorrect !== null);
  if (graded.length === 0) return null;
  const correct = graded.filter((p) => p.isCorrect).length;
  const pct = Math.round((correct / graded.length) * 100);
  return `${correct}/${graded.length} (${pct}%)`;
}

// ─── Per-user pick set row ────────────────────────────────────────────────────

/**
 * Inline form for submitting or editing a full set of picks.
 * Used both for pending users (submit) and submitted users (edit all).
 */
function PickForm({
  games,
  weekId,
  pickSetId,
  favoriteTeam,
  initialPicks,
  ruleLMS,
  lmsTeams,
  initialLmsTeamId,
  onSuccess,
  onCancel,
  userId, // only set when submitting for a new pick set
}: {
  games: Game[];
  weekId: string;
  pickSetId?: string;
  favoriteTeam: string;
  initialPicks: Record<string, string>; // gameId → teamId
  ruleLMS: boolean;
  lmsTeams: Team[];
  initialLmsTeamId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  userId?: string;
}) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [lmsTeamId, setLmsTeamId] = useState<string>(initialLmsTeamId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickedCount = Object.keys(picks).length;
  const allPicked = pickedCount === games.length;

  async function handleSubmit() {
    if (!allPicked) {
      setError(`Please pick a team for all ${games.length} games (${games.length - pickedCount} remaining)`);
      return;
    }
    setSaving(true);
    setError(null);

    const pickList = Object.entries(picks).map(([gameId, pickedTeamId]) => ({ gameId, pickedTeamId }));

    let res: Response;
    if (userId) {
      // Creating a new pick set for a pending user
      res = await fetch("/api/admin/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          weekId,
          picks: pickList,
          lmsTeamId: lmsTeamId || undefined,
        }),
      });
    } else {
      // Replacing all picks on an existing pick set
      res = await fetch(`/api/admin/picks/${pickSetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replaceAllPicks",
          picks: pickList,
        }),
      });

      // Also save LMS pick if changed
      if (ruleLMS && lmsTeamId !== (initialLmsTeamId ?? "")) {
        await fetch(`/api/admin/picks/${pickSetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "editLmsPick", teamId: lmsTeamId || null }),
        });
      }
    }

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Failed (${res.status})`);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      {/* Game pick buttons */}
      {games.map((game) => {
        const isFavHome = game.homeTeam.name === favoriteTeam;
        const isFavAway = game.awayTeam.name === favoriteTeam;
        const picked = picks[game.id];
        return (
          <div key={game.id} className="flex items-center gap-2">
            {/* Away */}
            <button
              onClick={() => setPicks((p) => ({ ...p, [game.id]: game.awayTeam.id }))}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                picked === game.awayTeam.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : isFavAway
                  ? "border-yellow-600/50 bg-yellow-600/10 text-zinc-300 hover:border-yellow-500 hover:bg-yellow-600/20"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              <img
                src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.awayTeam.espnId}.png`}
                alt={game.awayTeam.abbreviation}
                className="h-5 w-5 object-contain"
              />
              {game.awayTeam.abbreviation}
              {isFavAway && <span className="ml-auto text-xs text-yellow-500">★</span>}
            </button>

            <span className="shrink-0 text-xs text-zinc-600">@</span>

            {/* Home */}
            <button
              onClick={() => setPicks((p) => ({ ...p, [game.id]: game.homeTeam.id }))}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                picked === game.homeTeam.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : isFavHome
                  ? "border-yellow-600/50 bg-yellow-600/10 text-zinc-300 hover:border-yellow-500 hover:bg-yellow-600/20"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              <img
                src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.homeTeam.espnId}.png`}
                alt={game.homeTeam.abbreviation}
                className="h-5 w-5 object-contain"
              />
              {game.homeTeam.abbreviation}
              {isFavHome && <span className="ml-auto text-xs text-yellow-500">★</span>}
            </button>
          </div>
        );
      })}

      {/* LMS pick */}
      {ruleLMS && lmsTeams.length > 0 && (
        <div className="mt-3 rounded-lg border border-purple-700/30 bg-purple-900/10 px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-purple-400">⚔️ LMS Pick</p>
          <select
            value={lmsTeamId}
            onChange={(e) => setLmsTeamId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
          >
            <option value="">— No LMS pick —</option>
            {lmsTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.abbreviation})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Footer */}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : userId ? "Submit Picks" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          Cancel
        </button>
        {!allPicked && (
          <span className="text-xs text-zinc-500">
            {pickedCount}/{games.length} picked
          </span>
        )}
      </div>
    </div>
  );
}

function PickSetRow({
  pickSet,
  lmsPick,
  games,
  weekId,
  ruleLMS,
  lmsTeams,
  onRefresh,
}: {
  pickSet: PickSet;
  lmsPick?: LmsPick | null;
  games: Game[];
  weekId: string;
  ruleLMS: boolean;
  lmsTeams: Team[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formMode, setFormMode] = useState<"none" | "submit" | "edit-all">("none");
  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isPending = !pickSet.submittedAt;
  const displayName = pickSet.user.alias || pickSet.user.name || pickSet.user.email;
  const score = scoreLabel(pickSet.picks);

  /** Build the initial draft picks for the form. */
  function buildInitialPicks(): Record<string, string> {
    if (!isPending && pickSet.picks.length > 0) {
      // Pre-fill from existing picks when editing
      return Object.fromEntries(
        pickSet.picks
          .filter((p) => p.pickedTeam)
          .map((p) => [p.gameId, p.pickedTeam.id])
      );
    }
    // For pending users: pre-select their favourite team where playing
    const draft: Record<string, string> = {};
    for (const game of games) {
      if (game.homeTeam.name === pickSet.user.favoriteTeam) draft[game.id] = game.homeTeam.id;
      else if (game.awayTeam.name === pickSet.user.favoriteTeam) draft[game.id] = game.awayTeam.id;
    }
    return draft;
  }

  function openForm(mode: "submit" | "edit-all") {
    setFormMode(mode);
    setExpanded(true);
    setEditingPickId(null);
  }

  function closeForm() {
    setFormMode("none");
  }

  async function handleLockToggle() {
    setActionLoading(true);
    const action = pickSet.lockedAt ? "unlock" : "lock";
    await fetch(`/api/admin/picks/${pickSet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionLoading(false);
    onRefresh();
  }

  async function handlePickEdit(pickId: string, pickedTeamId: string) {
    await fetch(`/api/admin/picks/${pickSet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "editPick", pickId, pickedTeamId }),
    });
    setEditingPickId(null);
    onRefresh();
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30">
      {/* Row header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setExpanded((e) => !e); setFormMode("none"); }} className="text-left">
            <span className="font-medium text-zinc-100">{displayName}</span>
            <span className="ml-2 text-xs text-zinc-500">{pickSet.user.email}</span>
          </button>
          {statusBadge(pickSet)}
          {score && (
            <span className="inline-flex rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              {score}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            // Pending: show "Enter Picks" button
            <button
              onClick={() => openForm("submit")}
              className="rounded-md bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30"
            >
              Enter Picks
            </button>
          ) : (
            <>
              <button
                onClick={handleLockToggle}
                disabled={actionLoading}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                  pickSet.lockedAt
                    ? "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                    : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                }`}
              >
                {pickSet.lockedAt ? "Unlock" : "Lock"}
              </button>
              <button
                onClick={() => {
                  if (formMode === "edit-all") {
                    closeForm();
                  } else {
                    openForm("edit-all");
                  }
                }}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
              >
                {formMode === "edit-all" ? "Cancel Edit" : "Edit Picks"}
              </button>
              <button
                onClick={() => { setExpanded((e) => !e); if (formMode !== "none") setFormMode("none"); }}
                className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
              >
                {expanded && formMode === "none" ? "Hide" : "View"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">

          {/* ── Submit/Edit-all form ── */}
          {(formMode === "submit" || formMode === "edit-all") && (
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {formMode === "submit" ? `Submitting picks for ${displayName}` : `Editing all picks for ${displayName}`}
                {pickSet.user.favoriteTeam && (
                  <span className="ml-2 normal-case font-normal text-yellow-600">
                    ★ Fav: {pickSet.user.favoriteTeam}
                  </span>
                )}
              </p>
              <PickForm
                games={games}
                weekId={weekId}
                pickSetId={formMode === "edit-all" ? pickSet.id : undefined}
                userId={formMode === "submit" ? pickSet.user.id : undefined}
                favoriteTeam={pickSet.user.favoriteTeam}
                initialPicks={buildInitialPicks()}
                ruleLMS={ruleLMS}
                lmsTeams={lmsTeams}
                initialLmsTeamId={lmsPick?.teamId ?? undefined}
                onSuccess={() => { closeForm(); onRefresh(); }}
                onCancel={closeForm}
              />
            </div>
          )}

          {/* ── Existing picks view (only when not in form mode) ── */}
          {formMode === "none" && (
            <>
              {/* LMS pick display */}
              {lmsPick !== undefined && lmsPick !== null && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-700/30 bg-purple-900/10 px-3 py-2">
                  <span className="text-xs font-semibold text-purple-400">⚔️ LMS Pick</span>
                  {lmsPick.team ? (
                    <>
                      <img
                        src={`https://a.espncdn.com/i/teamlogos/nfl/500/${lmsPick.team.espnId}.png`}
                        alt={lmsPick.team.abbreviation}
                        className="h-5 w-5 object-contain"
                      />
                      <span className="text-sm font-medium text-zinc-100">{lmsPick.team.abbreviation}</span>
                      {lmsPick.eliminated ? (
                        <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-xs text-red-400">💀 Eliminated</span>
                      ) : (
                        <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-xs text-green-400">✓ Still in</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">No LMS pick submitted</span>
                  )}
                </div>
              )}
              {lmsPick === null && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-700/30 bg-zinc-800/30 px-3 py-2">
                  <span className="text-xs font-semibold text-purple-400/50">⚔️ LMS Pick</span>
                  <span className="text-xs text-zinc-600">No LMS pick submitted</span>
                </div>
              )}

              {/* Per-pick list with inline edit */}
              {pickSet.picks.length === 0 ? (
                <p className="text-sm text-zinc-500">No picks submitted yet.</p>
              ) : (
                <div className="space-y-2">
                  {pickSet.picks.map((pick) => {
                    const isEditing = editingPickId === pick.id;
                    const game = pick.game;
                    return (
                      <div
                        key={pick.id}
                        className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-zinc-400">
                            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                          </span>
                          <span className="text-zinc-200">→</span>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handlePickEdit(pick.id, game.awayTeam.id)}
                                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                  pick.pickedTeam?.id === game.awayTeam.id
                                    ? "bg-indigo-600 text-white"
                                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                }`}
                              >
                                {game.awayTeam.abbreviation}
                              </button>
                              <button
                                onClick={() => handlePickEdit(pick.id, game.homeTeam.id)}
                                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                  pick.pickedTeam?.id === game.homeTeam.id
                                    ? "bg-indigo-600 text-white"
                                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                }`}
                              >
                                {game.homeTeam.abbreviation}
                              </button>
                              <button
                                onClick={() => setEditingPickId(null)}
                                className="ml-1 rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              {pick.pickedTeam && (
                                <img
                                  src={`https://a.espncdn.com/i/teamlogos/nfl/500/${pick.pickedTeam.espnId}.png`}
                                  alt={pick.pickedTeam.name}
                                  className="h-5 w-5 object-contain"
                                />
                              )}
                              <span className="font-medium text-zinc-100">
                                {pick.pickedTeam?.abbreviation ?? "—"}
                              </span>
                              {pick.isCorrect === true && (
                                <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-xs text-green-400">✓ Correct</span>
                              )}
                              {pick.isCorrect === false && (
                                <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-xs text-red-400">✗ Wrong</span>
                              )}
                              {pick.editedBy === "admin" && (
                                <span className="rounded bg-orange-600/20 px-1.5 py-0.5 text-xs text-orange-400">edited</span>
                              )}
                            </>
                          )}
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => setEditingPickId(pick.id)}
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Confirm Results section ─────────────────────────────────────────────────

function ConfirmResults({
  games: initialGames,
  weekId,
  confirmedAt,
  nextWeekId,
  nextWeekLabel,
  onConfirmed,
}: {
  games: Game[];
  weekId: string;
  confirmedAt: string | null;
  nextWeekId: string | null;
  nextWeekLabel: string | null;
  onConfirmed: (advancedToWeekId?: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [advanceToNext, setAdvanceToNext] = useState(false);
  // Keep a local copy so setting a winner updates in-place without re-ordering
  const [games, setGames] = useState<Game[]>(initialGames);

  // Sync when parent refreshes (e.g. week change), but preserve order
  useEffect(() => {
    setGames((prev) => {
      if (prev.length === 0) return initialGames;
      const byId = Object.fromEntries(initialGames.map((g) => [g.id, g]));
      return prev.map((g) => byId[g.id] ?? g);
    });
  }, [initialGames]);

  async function handleSetWinner(gameId: string, winnerId: string | null) {
    setSaving(gameId);
    const res = await fetch(`/api/admin/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId, isTie: false }),
    });
    if (res.ok) {
      const data = await res.json();
      setGames((gs) =>
        gs.map((g) => (g.id === gameId ? { ...g, winner: data.game.winner, isTie: false } : g))
      );
    }
    setSaving(null);
  }

  async function handleSetTie(gameId: string, currentlyTie: boolean) {
    setSaving(gameId);
    const res = await fetch(`/api/admin/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId: null, isTie: !currentlyTie }),
    });
    if (res.ok) {
      const data = await res.json();
      setGames((gs) =>
        gs.map((g) => (g.id === gameId ? { ...g, winner: null, isTie: data.game.isTie } : g))
      );
    }
    setSaving(null);
  }

  async function handleConfirmAll() {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/admin/confirm-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setConfirmError(data.error ?? "Failed to confirm results");
        return;
      }
      // Advance to next week if requested
      if (advanceToNext && nextWeekId) {
        await fetch(`/api/admin/weeks/${nextWeekId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCurrent: true }),
        });
        onConfirmed(nextWeekId);
      } else {
        onConfirmed();
      }
    } catch {
      setConfirmError("Network error — please try again");
    } finally {
      setConfirming(false);
    }
  }

  const winnersEntered = games.filter((g) => g.winner !== null || g.isTie).length;
  const allGamesHaveWinners = games.length > 0 && winnersEntered === games.length;

  return (
    <div className="rounded-lg border border-indigo-800 bg-indigo-900/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-zinc-100">Enter Results</span>
          <span className="rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs text-indigo-300">
            {winnersEntered}/{games.length} winners entered
          </span>
          {confirmedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Results Published
            </span>
          )}
        </div>
        <span className="text-zinc-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-indigo-800/50 px-5 pb-5 pt-4 space-y-3">
          {games.map((game) => {
            const isSaving = saving === game.id;
            const awayWon = game.winner?.id === game.awayTeam.id;
            const homeWon = game.winner?.id === game.homeTeam.id;
            const resolved = awayWon || homeWon || game.isTie;
            return (
              <div key={game.id} className="flex items-center gap-2">
                <div className="flex flex-1 gap-2">
                  {/* Away team */}
                  <button
                    onClick={() => handleSetWinner(game.id, awayWon ? null : game.awayTeam.id)}
                    disabled={isSaving}
                    className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                      awayWon
                        ? "border-green-500 bg-green-500/20 text-green-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    <img
                      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.awayTeam.espnId}.png`}
                      alt={game.awayTeam.name}
                      className="h-6 w-6 object-contain"
                    />
                    {game.awayTeam.abbreviation}
                    {awayWon && <span className="ml-auto text-green-400">✓</span>}
                  </button>

                  <span className="flex items-center text-xs text-zinc-500 px-1">@</span>

                  {/* Home team */}
                  <button
                    onClick={() => handleSetWinner(game.id, homeWon ? null : game.homeTeam.id)}
                    disabled={isSaving}
                    className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                      homeWon
                        ? "border-green-500 bg-green-500/20 text-green-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    <img
                      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.homeTeam.espnId}.png`}
                      alt={game.homeTeam.name}
                      className="h-6 w-6 object-contain"
                    />
                    {game.homeTeam.abbreviation}
                    {homeWon && <span className="ml-auto text-green-400">✓</span>}
                  </button>

                  {/* TIE button */}
                  <button
                    onClick={() => handleSetTie(game.id, game.isTie)}
                    disabled={isSaving}
                    className={`flex items-center rounded-lg border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                      game.isTie
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Mark as tie — picks for this game won't be scored"
                  >
                    TIE
                  </button>
                </div>

                {resolved && (
                  <button
                    onClick={() => {
                      if (game.isTie) handleSetTie(game.id, true);
                      else handleSetWinner(game.id, null);
                    }}
                    disabled={isSaving}
                    className="text-xs text-zinc-600 hover:text-zinc-400 disabled:opacity-40"
                    title="Clear result"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* Confirm All Results button */}
          <div className="mt-4 border-t border-indigo-800/30 pt-4 space-y-3">
            {confirmError && (
              <p className="text-sm text-red-400">{confirmError}</p>
            )}

            {/* Advance to next week option */}
            {nextWeekId && (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={advanceToNext}
                  onChange={(e) => setAdvanceToNext(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="text-sm text-zinc-300">
                  Also advance current week to{" "}
                  <span className="font-semibold text-indigo-300">{nextWeekLabel}</span>
                </span>
              </label>
            )}

            <div className="flex items-center gap-4">
              <button
                onClick={handleConfirmAll}
                disabled={!allGamesHaveWinners || confirming}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  allGamesHaveWinners
                    ? "bg-green-600 text-white hover:bg-green-500"
                    : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {confirming
                  ? advanceToNext && nextWeekId ? "Publishing & Advancing…" : "Publishing…"
                  : confirmedAt
                  ? "Re-Publish Results"
                  : "Publish All Results"}
              </button>
              {!allGamesHaveWinners && (
                <p className="text-xs text-zinc-500">
                  Enter all {games.length - winnersEntered} remaining winner
                  {games.length - winnersEntered !== 1 ? "s" : ""} first
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auto-lock time control ───────────────────────────────────────────────────

function LockTimeControl({
  weekId,
  lockAt,
  lockedForSubmission,
  onUpdate,
}: {
  weekId: string;
  lockAt: string | null;
  lockedForSubmission: boolean;
  onUpdate: (newLockAt: string | null) => void;
}) {
  // datetime-local value in UTC — displayed as "YYYY-MM-DDTHH:mm"
  const toInputValue = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    // Format as UTC datetime-local value
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  const [inputValue, setInputValue] = useState<string>(toInputValue(lockAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep current time updated for countdown
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Sync input when parent lockAt changes
  useEffect(() => {
    setInputValue(toInputValue(lockAt));
  }, [lockAt]);

  async function handleSet() {
    if (!inputValue) return;
    setSaving(true);
    setError(null);
    try {
      // Treat the input as UTC by appending Z
      const lockAtUtc = new Date(inputValue + "Z").toISOString();
      if (isNaN(new Date(lockAtUtc).getTime())) {
        setError("Invalid date/time");
        return;
      }
      const res = await fetch("/api/admin/picks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setLockTime", weekId, lockAt: lockAtUtc }),
      });
      if (res.ok) {
        onUpdate(lockAtUtc);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Server error (${res.status})`);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/picks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearLockTime", weekId }),
      });
      if (res.ok) {
        setInputValue("");
        onUpdate(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Server error (${res.status})`);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // Countdown helper
  function countdown(iso: string): string {
    const target = new Date(iso).getTime();
    const diff = target - now.getTime();
    if (diff <= 0) return "overdue";
    const totalSecs = Math.floor(diff / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const isScheduled = !!lockAt && !lockedForSubmission;
  const isPast = !!lockAt && new Date(lockAt) <= now;

  return (
    <div className="mt-3 border-t border-zinc-700/50 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Auto-Lock Time <span className="normal-case font-normal text-zinc-600">(UTC)</span>
      </p>

      {/* Current scheduled time */}
      {lockAt && (
        <div className="mb-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            lockedForSubmission
              ? "bg-zinc-700/50 text-zinc-500"
              : isPast
              ? "bg-amber-600/20 text-amber-400"
              : "bg-indigo-600/20 text-indigo-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              lockedForSubmission ? "bg-zinc-500" : isPast ? "bg-amber-400 animate-pulse" : "bg-indigo-400"
            }`} />
            {lockedForSubmission
              ? "Already locked"
              : isPast
              ? `Overdue — locks on next check`
              : `Locks in ${countdown(lockAt)}`}
          </span>
          <span className="text-xs text-zinc-500">
            {new Date(lockAt).toUTCString().replace(" GMT", " UTC")}
          </span>
        </div>
      )}

      {/* Input + buttons */}
      {!lockedForSubmission && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSet}
            disabled={!inputValue || saving}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : isScheduled ? "Update" : "Set"}
          </button>
          {lockAt && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportPicksAsCsv(week: Week, games: Game[], pickSets: PickSet[]) {
  // Helper: wrap a cell value in quotes and escape any internal quotes
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

  // ── Header row ──────────────────────────────────────────────────────────────
  // Fixed columns: Player | Email | Status | Score
  // Then one column per game: "AWAY @ HOME (result)"
  const gameHeaders = games.map((g) => {
    const result = g.isTie ? "TIE" : g.winner ? `${g.winner.abbreviation} won` : "TBD";
    return cell(`${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation} [${result}]`);
  });

  const header = [
    cell("Player"),
    cell("Email"),
    cell("Status"),
    cell("Score"),
    ...gameHeaders,
  ].join(",");

  // ── Data rows ────────────────────────────────────────────────────────────────
  // Build a lookup: gameId → pick for quick access
  const rows = pickSets.map((ps) => {
    const displayName = ps.user.alias ?? ps.user.name ?? ps.user.email;
    const status = ps.lockedAt ? "Locked" : ps.submittedAt ? "Unlocked" : "Pending";

    const graded = ps.picks.filter((p) => p.isCorrect !== null);
    const correct = graded.filter((p) => p.isCorrect === true).length;
    const score =
      graded.length > 0
        ? `${correct}/${graded.length} (${Math.round((correct / graded.length) * 100)}%)`
        : "Not graded";

    const pickByGame = Object.fromEntries(ps.picks.map((p) => [p.gameId, p]));

    const gameCells = games.map((g) => {
      const pick = pickByGame[g.id];
      if (!pick) return cell("No pick");

      const abbr = pick.pickedTeam.abbreviation;
      if (pick.isCorrect === true) return cell(`${abbr} (correct)`);
      if (pick.isCorrect === false) return cell(`${abbr} (wrong)`);
      return cell(abbr);
    });

    return [cell(displayName), cell(ps.user.email), cell(status), cell(score), ...gameCells].join(
      ","
    );
  });

  // ── Assemble and trigger download ────────────────────────────────────────────
  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows opens the file correctly
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `picks-${week.season.year}-${week.label.replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminPicksContent() {
  const searchParams = useSearchParams();
  const urlWeekId = searchParams.get("weekId");

  const [week, setWeek] = useState<Week | null>(null);
  const [pickSets, setPickSets] = useState<PickSet[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>(urlWeekId ?? "");
  const [loading, setLoading] = useState(true);
  const [weekActionLoading, setWeekActionLoading] = useState(false);
  const [ruleLMS, setRuleLMS] = useState(false);
  const [lmsPicksByUserId, setLmsPicksByUserId] = useState<Record<string, LmsPick>>({});
  const [lmsTeams, setLmsTeams] = useState<Team[]>([]);

  const fetchPicks = useCallback(async (weekId?: string) => {
    setLoading(true);
    const url = weekId ? `/api/admin/picks?weekId=${weekId}` : "/api/admin/picks";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setWeek(data.week);
      setPickSets(data.pickSets);
      setGames(data.games ?? []);
      setWeeks(data.weeks);
      setRuleLMS(data.ruleLMS ?? false);
      setLmsPicksByUserId(data.lmsPicksByUserId ?? {});
      setLmsTeams(data.lmsTeams ?? []);
      if (!selectedWeekId && data.week) {
        setSelectedWeekId(data.week.id);
      }
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPicks(urlWeekId ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWeekChange(weekId: string) {
    setSelectedWeekId(weekId);
    fetchPicks(weekId);
  }

  async function handleWeekLockToggle() {
    if (!week) return;
    setWeekActionLoading(true);
    const action = week.lockedForSubmission ? "unlockWeek" : "lockWeek";
    const res = await fetch("/api/admin/picks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, weekId: week.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setWeek((w) => w ? { ...w, lockedForSubmission: data.week.lockedForSubmission } : w);
    }
    setWeekActionLoading(false);
  }

  function handleLockAtUpdate(newLockAt: string | null) {
    setWeek((w) => w ? { ...w, lockAt: newLockAt } : w);
  }

  const refresh = (advancedToWeekId?: string) => {
    if (advancedToWeekId) {
      handleWeekChange(advancedToWeekId);
    } else {
      fetchPicks(selectedWeekId || undefined);
    }
  };

  // Find the week that immediately follows the current one in the same season
  const nextWeek = week
    ? weeks.find((w) => w.season.id === week.season.id && w.number === week.number + 1) ?? null
    : null;

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="picks" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Header row */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <h2 className="text-xl font-bold text-zinc-50">Pick Results</h2>
          {weeks.length > 0 && (
            <select
              value={selectedWeekId}
              onChange={(e) => handleWeekChange(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.season.year} — {w.label}
                </option>
              ))}
            </select>
          )}
          {week && pickSets.length > 0 && (
            <button
              onClick={() => exportPicksAsCsv(week, games, pickSets)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v8m0 0-3-3m3 3 3-3M3 13h10" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : !week ? (
          <p className="text-zinc-400">No active week found.</p>
        ) : (
          <div className="space-y-6">
            {/* Week lock control */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-zinc-100">
                      {week.season.year} · {week.label}
                    </span>
                    {week.lockedForSubmission ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        Submissions Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Accepting Submissions
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {week.lockedForSubmission
                      ? "No new picks can be submitted. Unlock to re-open submissions."
                      : "Locking the week prevents any new pick submissions."}
                  </p>
                </div>
                <button
                  onClick={handleWeekLockToggle}
                  disabled={weekActionLoading}
                  className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    week.lockedForSubmission
                      ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      : "bg-red-600 text-white hover:bg-red-500"
                  }`}
                >
                  {weekActionLoading
                    ? "..."
                    : week.lockedForSubmission
                    ? "Unlock Week"
                    : "Lock Week"}
                </button>
              </div>

              {/* Auto-lock time picker */}
              <LockTimeControl
                weekId={week.id}
                lockAt={week.lockAt}
                lockedForSubmission={week.lockedForSubmission}
                onUpdate={handleLockAtUpdate}
              />
            </div>

            {/* Confirm Results (only when week is locked) */}
            {week.lockedForSubmission && games.length > 0 && (
              <ConfirmResults
                games={games}
                weekId={week.id}
                confirmedAt={week.confirmedAt}
                nextWeekId={nextWeek?.id ?? null}
                nextWeekLabel={nextWeek?.label ?? null}
                onConfirmed={refresh}
              />
            )}

            {/* Pick sets */}
            <div>
              <p className="mb-3 text-sm text-zinc-400">
                {pickSets.length} submission{pickSets.length !== 1 ? "s" : ""}
              </p>
              {pickSets.length === 0 ? (
                <p className="text-zinc-500">No picks submitted for this week yet.</p>
              ) : (
                <div className="space-y-3">
                  {pickSets.map((ps) => (
                    <PickSetRow
                      key={ps.id}
                      pickSet={ps}
                      lmsPick={ruleLMS ? (lmsPicksByUserId[ps.user.id] ?? null) : undefined}
                      games={games}
                      weekId={week.id}
                      ruleLMS={ruleLMS}
                      lmsTeams={lmsTeams}
                      onRefresh={refresh}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
