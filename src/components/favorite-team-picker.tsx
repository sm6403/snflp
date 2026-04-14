"use client";

import { useState } from "react";
import { NFL_TEAMS, getTeamLogoUrl } from "@/lib/nfl-teams";

export function FavoriteTeamPicker({
  initialTeam,
  initialLocked = false,
}: {
  initialTeam: string;
  initialLocked?: boolean;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [locked, setLocked] = useState(initialLocked);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(initialTeam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/favorite-team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: selected }),
    });

    if (res.ok) {
      const data = await res.json();
      setTeam(data.favoriteTeam ?? selected);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    }
    setLoading(false);
  }

  async function handleToggleLock() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/favorite-team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: !locked }),
    });

    if (res.ok) {
      const data = await res.json();
      setLocked(data.favoriteTeamLocked ?? !locked);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to update lock");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Favorite NFL Team
        </h3>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
            🔒 Locked
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {editing ? (
        <div className="mt-3 space-y-3">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            {NFL_TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setSelected(team); setError(null); }}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <img src={getTeamLogoUrl(team)} alt={team} className="h-10 w-10 object-contain" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{team}</p>
          </div>
          <div className="flex gap-2">
            {locked ? (
              // Locked — only admin can unlock; show a quiet info label
              <span className="text-xs text-zinc-500 self-center">
                Contact your admin to change
              </span>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={handleToggleLock}
                  disabled={loading}
                  title="Lock in your favourite team — only an admin can unlock it"
                  className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {loading ? "..." : "🔒 Lock"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
