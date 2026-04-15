"use client";

import { useState } from "react";

export function JoinLeagueForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLeague, setPendingLeague] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/join-league", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.joined) {
        window.location.reload();
      } else if (data.pending) {
        setPendingLeague(data.league?.name ?? "the league");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (pendingLeague) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center">
        <p className="text-amber-300 font-medium">Request Pending</p>
        <p className="mt-2 text-sm text-zinc-400">
          Your request to join <span className="font-semibold text-zinc-200">{pendingLeague}</span> is pending approval from the league admin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Join a League</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Enter the 6-digit invite code from your league administrator.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex-1 max-w-48">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            maxLength={6}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-lg font-mono tracking-widest text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join League"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
