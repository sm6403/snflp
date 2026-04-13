"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLogoutButton } from "./admin-logout-button";

type ActiveTab = "users" | "picks" | "settings";

export function AdminHeader({ active }: { active: ActiveTab }) {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setMode(d.settings?.mode ?? null))
      .catch(() => {});
  }, []);

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
              Picks
            </Link>
            <Link
              href="/admindash/settings"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${active === "settings" ? "font-medium text-zinc-200" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Settings
            </Link>
          </nav>
          <AdminLogoutButton />
        </div>
      </div>
    </header>
  );
}
