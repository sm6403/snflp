"use client";

import { useState } from "react";
import { NFL_TEAMS } from "@/lib/nfl-teams";

export function FavoriteTeamPicker({ initialTeam }: { initialTeam: string }) {
  const [team, setTeam] = useState(initialTeam);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(initialTeam);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/user/favorite-team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: selected }),
    });

    if (res.ok) {
      setTeam(selected);
      setEditing(false);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Favorite NFL Team
      </h3>

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
              {loading ? "Saving..." : "Submit"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelected(team);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            {/* Team logo placeholder */}
            <span className="text-lg">🏈</span>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {team}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
