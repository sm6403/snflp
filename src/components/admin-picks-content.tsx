"use client";

import { useCallback, useEffect, useState } from "react";
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
}

interface Pick {
  id: string;
  gameId: string;
  pickedTeam: Team;
  editedBy: string | null;
  game: Game;
}

interface PickSet {
  id: string;
  submittedAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  user: { id: string; name: string | null; email: string; alias: string | null };
  picks: Pick[];
}

interface WeekOption {
  id: string;
  number: number;
  label: string;
  season: { year: number };
}

interface Week {
  id: string;
  number: number;
  label: string;
  season: { year: number };
}

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

function PickSetRow({
  pickSet,
  onRefresh,
}: {
  pickSet: PickSet;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const displayName = pickSet.user.alias || pickSet.user.name || pickSet.user.email;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-left"
          >
            <span className="font-medium text-zinc-100">{displayName}</span>
            <span className="ml-2 text-xs text-zinc-500">{pickSet.user.email}</span>
          </button>
          {statusBadge(pickSet)}
          {pickSet.picks.length > 0 && (
            <span className="text-xs text-zinc-500">
              {pickSet.picks.length} pick{pickSet.picks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLockToggle}
            disabled={actionLoading || !pickSet.submittedAt}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
              pickSet.lockedAt
                ? "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
            }`}
          >
            {pickSet.lockedAt ? "Unlock" : "Lock"}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
          >
            {expanded ? "Hide" : "View Picks"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
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
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-400">
                        {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                      </span>
                      <span className="text-zinc-200">→</span>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handlePickEdit(pick.id, game.awayTeam.id)}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                              pick.pickedTeam.id === game.awayTeam.id
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                            }`}
                          >
                            {game.awayTeam.abbreviation}
                          </button>
                          <button
                            onClick={() => handlePickEdit(pick.id, game.homeTeam.id)}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                              pick.pickedTeam.id === game.homeTeam.id
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
                          <img
                            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${pick.pickedTeam.espnId}.png`}
                            alt={pick.pickedTeam.name}
                            className="h-5 w-5 object-contain"
                          />
                          <span className="font-medium text-zinc-100">
                            {pick.pickedTeam.abbreviation}
                          </span>
                          {pick.editedBy === "admin" && (
                            <span className="rounded bg-orange-600/20 px-1.5 py-0.5 text-xs text-orange-400">
                              edited
                            </span>
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
        </div>
      )}
    </div>
  );
}

export function AdminPicksContent() {
  const [week, setWeek] = useState<Week | null>(null);
  const [pickSets, setPickSets] = useState<PickSet[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchPicks = useCallback(async (weekId?: string) => {
    setLoading(true);
    const url = weekId ? `/api/admin/picks?weekId=${weekId}` : "/api/admin/picks";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setWeek(data.week);
      setPickSets(data.pickSets);
      setWeeks(data.weeks);
      if (!selectedWeekId && data.week) {
        setSelectedWeekId(data.week.id);
      }
    }
    setLoading(false);
  }, [selectedWeekId]);

  useEffect(() => {
    fetchPicks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWeekChange(weekId: string) {
    setSelectedWeekId(weekId);
    fetchPicks(weekId);
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="picks" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center gap-4">
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
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : !week ? (
          <p className="text-zinc-400">No active week found.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-400">
              {week.season.year} · {week.label} ·{" "}
              <span className="text-zinc-300">
                {pickSets.length} submission{pickSets.length !== 1 ? "s" : ""}
              </span>
            </p>
            {pickSets.length === 0 ? (
              <p className="text-zinc-500">No picks submitted for this week yet.</p>
            ) : (
              <div className="space-y-3">
                {pickSets.map((ps) => (
                  <PickSetRow
                    key={ps.id}
                    pickSet={ps}
                    onRefresh={() => fetchPicks(selectedWeekId || undefined)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
