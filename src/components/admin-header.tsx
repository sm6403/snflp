"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLogoutButton } from "./admin-logout-button";

type ActiveTab = "users" | "picks" | "seasons" | "settings" | "leaderboard" | "activity" | "leagues";

export function AdminHeader({ active }: { active: ActiveTab }) {
  const [mode, setMode] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [leagueContextName, setLeagueContextName] = useState<string | null>(null);
  const [allLeagues, setAllLeagues] = useState<Array<{ id: string; name: string }>>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setMode(d.settings?.mode ?? null);
        setIsSuperAdmin(d.isSuperAdmin ?? false);
        if (d.leagueId) {
          setActiveLeagueId(d.leagueId);
        }
      })
      .catch(() => {});
    fetch("/api/admin/leagues")
      .then((r) => r.json())
      .then((d) => {
        const leagues = d.leagues ?? [];
        const mapped = leagues.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
        setAllLeagues(mapped);
        if (leagues.length === 1) {
          setActiveLeagueId(leagues[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Sync league name whenever both activeLeagueId and allLeagues are available
  useEffect(() => {
    if (activeLeagueId && allLeagues.length > 0) {
      const match = allLeagues.find((l) => l.id === activeLeagueId);
      setLeagueContextName(match?.name ?? null);
    }
  }, [activeLeagueId, allLeagues]);

  async function handleLeagueSwitch(leagueId: string) {
    setActiveLeagueId(leagueId);
    const league = allLeagues.find((l) => l.id === leagueId);
    setLeagueContextName(league?.name ?? null);
    await fetch("/api/admin/leagues/set-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId }),
    });
    window.location.reload();
  }

  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-50">Admin Dashboard</h1>
          {mode === "live" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              LIVE
            </span>
          )}
          {mode === "test" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              TEST
            </span>
          )}
          <span
            title="Deployed commit hash — compare with git log"
            className="rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 bg-zinc-800/60"
          >
            {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
          </span>
          {isSuperAdmin && allLeagues.length > 0 ? (
            <select
              value={activeLeagueId ?? ""}
              onChange={(e) => handleLeagueSwitch(e.target.value)}
              className="rounded-full border border-amber-600/40 bg-amber-600/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="" disabled className="bg-zinc-900 text-zinc-400">Select league…</option>
              {allLeagues.map((l) => (
                <option key={l.id} value={l.id} className="bg-zinc-900 text-zinc-200">{l.name}</option>
              ))}
            </select>
          ) : leagueContextName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              {leagueContextName}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1">
            <Link
              href="/admindash"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "users" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Users
            </Link>
            <Link
              href="/admindash/picks"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "picks" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Current Week
            </Link>
            <Link
              href="/admindash/seasons"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "seasons" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Seasons
            </Link>
            <Link
              href="/admindash/settings"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "settings" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Settings
            </Link>
            <Link
              href="/admindash/leaderboard"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "leaderboard" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Leaderboard
            </Link>
            <Link
              href="/admindash/activity"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "activity" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Activity
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admindash/leagues"
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "leagues" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                Leagues
              </Link>
            )}
          </nav>
          <AdminLogoutButton />
        </div>
      </div>
    </header>
  );
}
