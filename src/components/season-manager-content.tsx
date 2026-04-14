"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  espnId: string;
}

interface WeekSummary {
  id: string;
  number: number;
  label: string;
  isCurrent: boolean;
  lockedForSubmission: boolean;
  confirmedAt: string | null;
  _count: { games: number; pickSets: number };
}

interface SeasonSummary {
  id: string;
  year: number;
  type: "regular" | "postseason";
  mode: "live" | "test";
  isCurrent: boolean;
  timedAutolocking: boolean;
  ruleFavouriteTeamBonusWin: boolean;
  parentSeason: { id: string; year: number; type: string } | null;
  _count: { weeks: number };
  weeks: WeekSummary[];
}

interface GameRow {
  id?: string; // undefined for new rows
  homeTeamId: string;
  awayTeamId: string;
  gameTime: string; // datetime-local value (UTC)
}

type View =
  | { type: "list" }
  | { type: "season"; seasonId: string }
  | { type: "week"; weekId: string; seasonId: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeBadge(type: string) {
  return type === "postseason"
    ? <span className="inline-flex rounded-full bg-purple-600/20 px-2 py-0.5 text-xs font-semibold text-purple-400">Post-Season</span>
    : <span className="inline-flex rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-400">Regular</span>;
}

function modeBadge(mode: string) {
  return mode === "live"
    ? <span className="inline-flex rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">Live</span>
    : <span className="inline-flex rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">Test</span>;
}

function seasonLabel(s: SeasonSummary) {
  return `${s.year} ${s.type === "postseason" ? "Post-Season" : "Regular Season"}`;
}

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ─── Create Season Form ───────────────────────────────────────────────────────

function CreateSeasonForm({
  seasons,
  onCreated,
  onCancel,
}: {
  seasons: SeasonSummary[];
  onCreated: (s: SeasonSummary) => void;
  onCancel: () => void;
}) {
  const [year, setYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [type, setType] = useState<"regular" | "postseason">("regular");
  const [mode, setMode] = useState<"live" | "test">("live");
  const [parentSeasonId, setParentSeasonId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regularSeasons = seasons.filter((s) => s.type === "regular");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      setError("Enter a valid year (2000–2100)");
      return;
    }
    if (type === "postseason" && !parentSeasonId) {
      setError("Select a parent regular season for a post-season");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: yearNum,
          type,
          mode,
          parentSeasonId: type === "postseason" ? parentSeasonId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        onCreated(data.season);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-5">
      <h3 className="mb-4 text-base font-semibold text-zinc-100">Create New Season</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Year */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2000}
            max={2100}
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Type</label>
          <div className="flex gap-3">
            {(["regular", "postseason"] as const).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-zinc-300">
                  {t === "regular" ? "Regular Season" : "Post-Season"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Mode</label>
          <div className="flex gap-3">
            {(["live", "test"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-zinc-300 capitalize">{m}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {mode === "live"
              ? "Live seasons are visible to users when set as current."
              : "Test seasons only appear in the Test Week setting — users never see them directly."}
          </p>
        </div>

        {/* Parent season (postseason only) */}
        {type === "postseason" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Parent Regular Season
            </label>
            <select
              value={parentSeasonId}
              onChange={(e) => setParentSeasonId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select parent season…</option>
              {regularSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.year} Regular Season
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Season"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── View A: Season List ──────────────────────────────────────────────────────

function SeasonList({
  seasons,
  onRefresh,
  onNavigate,
}: {
  seasons: SeasonSummary[];
  onRefresh: () => void;
  onNavigate: (view: View) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchSeason(seasonId: string, key: string, data: Record<string, unknown>) {
    setActionLoading(seasonId + "-" + key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to update season");
      } else {
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  const handleSetActive = (seasonId: string) => patchSeason(seasonId, "active", { isCurrent: true });
  const handleToggleMode = (seasonId: string, currentMode: string) =>
    patchSeason(seasonId, "mode", { mode: currentMode === "live" ? "test" : "live" });
  const handleToggleTimedAutolocking = (seasonId: string, current: boolean) =>
    patchSeason(seasonId, "timedAutolock", { timedAutolocking: !current });

  async function handleDelete(seasonId: string) {
    setActionLoading(seasonId + "-delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Failed to delete");
      } else {
        setDeleteConfirm(null);
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-50">Seasons</h2>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            + Create Season
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {showCreateForm && (
        <CreateSeasonForm
          seasons={seasons}
          onCreated={(s) => {
            setShowCreateForm(false);
            onRefresh();
            onNavigate({ type: "season", seasonId: s.id });
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {seasons.length === 0 ? (
        <p className="text-zinc-500">No seasons yet. Create one above.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Season</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Weeks</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Timed Lock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {seasons.map((s) => (
                <tr key={s.id} className="bg-zinc-900 hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-100">{seasonLabel(s)}</td>
                  <td className="px-4 py-3">{typeBadge(s.type)}</td>
                  <td className="px-4 py-3">{modeBadge(s.mode)}</td>
                  <td className="px-4 py-3 text-zinc-400">{s._count.weeks}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleTimedAutolocking(s.id, s.timedAutolocking)}
                      disabled={actionLoading === s.id + "-timedAutolock"}
                      title="Games lock individually as each kickoff approaches"
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                        s.timedAutolocking
                          ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
                          : "bg-zinc-700/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {actionLoading === s.id + "-timedAutolock" ? "…" : s.timedAutolocking ? "⏰ On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {s.isCurrent && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          Active
                        </span>
                      )}
                      {(() => {
                        const cw = s.weeks.find((w) => w.isCurrent);
                        return cw ? (
                          <span className="inline-flex rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                            {cw.label}
                          </span>
                        ) : !s.isCurrent ? (
                          <span className="text-xs text-zinc-600">—</span>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Fixed-width slot so Manage is always in the same column */}
                      <div className="w-[72px] flex justify-center">
                        {!s.isCurrent && (
                          <button
                            onClick={() => handleSetActive(s.id)}
                            disabled={actionLoading === s.id + "-active"}
                            className="rounded-md px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40"
                          >
                            Set Active
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => onNavigate({ type: "season", seasonId: s.id })}
                        className="rounded-md px-3 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => handleToggleMode(s.id, s.mode)}
                        disabled={actionLoading === s.id + "-mode"}
                        title={`Switch to ${s.mode === "live" ? "test" : "live"} mode`}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          s.mode === "live"
                            ? "text-green-400 hover:bg-green-900/20 hover:text-green-300"
                            : "text-indigo-400 hover:bg-indigo-900/20 hover:text-indigo-300"
                        }`}
                      >
                        {actionLoading === s.id + "-mode"
                          ? "…"
                          : s.mode === "live"
                          ? "→ Test"
                          : "→ Live"}
                      </button>
                      {deleteConfirm === s.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-zinc-400">Sure?</span>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={actionLoading === s.id + "-delete"}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                          >
                            {actionLoading === s.id + "-delete" ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(s.id)}
                          className="rounded-md px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-900/20 hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── View B: Season Detail / Week Grid ───────────────────────────────────────

type ResetConfirmState = "idle" | "warn" | "confirming";

function SeasonDetail({
  season,
  eligibleUsersCount,
  onBack,
  onNavigate,
  onRefresh,
}: {
  season: SeasonSummary;
  eligibleUsersCount: number;
  onBack: () => void;
  onNavigate: (view: View) => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "custom-rules">("overview");
  const [addingWeek, setAddingWeek] = useState(false);
  const [settingCurrentWeek, setSettingCurrentWeek] = useState<string | null>(null);
  const [settingLock, setSettingLock] = useState<string | null>(null);
  const [resetWeekState, setResetWeekState] = useState<ResetConfirmState>("idle");
  const [resetSeasonState, setResetSeasonState] = useState<ResetConfirmState>("idle");
  const [resetting, setResetting] = useState<"week" | "season" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = season.weeks.find((w) => w.isCurrent) ?? null;

  async function handleAddWeek() {
    setAddingWeek(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${season.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addWeek: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to add week");
      } else {
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setAddingWeek(false);
    }
  }

  async function handleSetCurrentWeek(weekId: string) {
    setSettingCurrentWeek(weekId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to set current week");
      } else {
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSettingCurrentWeek(null);
    }
  }

  async function handleToggleLock(weekId: string, currentLocked: boolean) {
    setSettingLock(weekId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedForSubmission: !currentLocked }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to update lock");
      } else {
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSettingLock(null);
    }
  }

  async function handleResetWeek() {
    if (!currentWeek) return;
    setResetting("week");
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId: currentWeek.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Reset failed");
      } else {
        setResetWeekState("idle");
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setResetting(null);
    }
  }

  async function handleResetSeason() {
    setResetting("season");
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${season.id}/reset`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Reset failed");
      } else {
        setResetSeasonState("idle");
        onRefresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setResetting(null);
    }
  }

  const confirmedCount = season.weeks.filter((w) => w.confirmedAt).length;
  const scheduledCount = season.weeks.filter((w) => w._count.games > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          ← Seasons
        </button>
        <span className="text-zinc-600">/</span>
        <h2 className="text-xl font-bold text-zinc-50">{seasonLabel(season)}</h2>
        {typeBadge(season.type)}
        {modeBadge(season.mode)}
        {season.isCurrent && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Active
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-zinc-500">
        <span>{season.weeks.length} weeks</span>
        <span>·</span>
        <span>{scheduledCount} with games</span>
        <span>·</span>
        <span>{confirmedCount} confirmed</span>
        {currentWeek && (
          <>
            <span>·</span>
            <span className="text-indigo-400">Current: {currentWeek.label}</span>
          </>
        )}
        {season.parentSeason && (
          <>
            <span>·</span>
            <span>Parent: {season.parentSeason.year} Regular</span>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(["overview", "custom-rules"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-indigo-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "overview" ? "Overview" : "Custom Rules"}
          </button>
        ))}
      </div>

      {activeTab === "custom-rules" && (
        <CustomRulesTab season={season} />
      )}

      {activeTab === "overview" && <>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Week grid */}
      {season.weeks.length === 0 ? (
        <p className="text-zinc-500">No weeks yet. Add one below.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {season.weeks.map((w) => {
            const gameCount = w._count.games;
            const hasGames = gameCount > 0;
            const isConfirmed = !!w.confirmedAt;
            const isThisCurrent = w.isCurrent;
            const isSettingThis = settingCurrentWeek === w.id;

            return (
              <div
                key={w.id}
                className={`flex flex-col gap-2 rounded-lg border p-3 transition-all ${
                  isThisCurrent
                    ? "border-indigo-600/60 bg-indigo-900/10"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                {/* Click area for schedule editor */}
                <button
                  onClick={() => onNavigate({ type: "week", weekId: w.id, seasonId: season.id })}
                  className="flex flex-col gap-1.5 text-left hover:opacity-80 transition-opacity"
                >
                  <span className="text-sm font-semibold text-zinc-200">{w.label}</span>
                  {isConfirmed ? (
                    <span className="inline-flex rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                      Confirmed
                    </span>
                  ) : hasGames ? (
                    <span className="inline-flex rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                      {gameCount} game{gameCount !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      No games
                    </span>
                  )}
                  {eligibleUsersCount > 0 && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w._count.pickSets === eligibleUsersCount
                        ? "bg-green-600/20 text-green-400"
                        : w._count.pickSets > 0
                        ? "bg-amber-600/20 text-amber-400"
                        : "bg-zinc-700/60 text-zinc-500"
                    }`}>
                      {w._count.pickSets}/{eligibleUsersCount} submitted
                    </span>
                  )}
                  {w.lockedForSubmission && (
                    <span className="text-xs text-red-400">Locked</span>
                  )}
                </button>

                {/* Set Current Week */}
                {isThisCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetCurrentWeek(w.id)}
                    disabled={!!settingCurrentWeek}
                    className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:border-indigo-600/60 hover:text-indigo-400 disabled:opacity-40"
                  >
                    {isSettingThis ? "Setting…" : "Set Current"}
                  </button>
                )}

                {/* Lock/unlock toggle */}
                <button
                  onClick={() => handleToggleLock(w.id, w.lockedForSubmission)}
                  disabled={settingLock === w.id}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    w.lockedForSubmission
                      ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                      : "border border-zinc-700 text-zinc-500 hover:border-red-600/60 hover:text-red-400"
                  }`}
                >
                  {settingLock === w.id ? "…" : w.lockedForSubmission ? "🔒 Locked" : "🔓 Lock"}
                </button>

                {/* View Submissions */}
                <Link
                  href={`/admindash/picks?weekId=${w.id}`}
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
                >
                  Submissions
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Add week (postseason only) */}
      {season.type === "postseason" && (
        <button
          onClick={handleAddWeek}
          disabled={addingWeek}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
        >
          {addingWeek ? "Adding…" : "+ Add Week"}
        </button>
      )}

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-red-400">⚠ Danger Zone</span>
        </div>

        {/* Reset Current Week */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">Reset Current Week</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Permanently deletes all submitted picks for{" "}
                <span className="text-zinc-300">{currentWeek ? currentWeek.label : "the current week"}</span>,
                clears results, and unlocks submissions.
                {!currentWeek && <span className="text-amber-400"> No current week is set.</span>}
              </p>
            </div>
            {resetWeekState === "idle" && (
              <button
                onClick={() => setResetWeekState("warn")}
                disabled={!currentWeek}
                className="flex-shrink-0 rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset Week
              </button>
            )}
          </div>

          {resetWeekState === "warn" && (
            <div className="rounded-lg border border-red-700 bg-red-900/20 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-300">
                Are you absolutely sure?
              </p>
              <p className="text-xs text-red-400">
                This will <strong>permanently delete every pick</strong> submitted for{" "}
                {currentWeek?.label} of the {season.year} season. Game results will be cleared
                and the week will be unlocked. <strong>This cannot be undone.</strong>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResetWeekState("confirming")}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Yes, I understand — delete all picks for {currentWeek?.label}
                </button>
                <button
                  onClick={() => setResetWeekState("idle")}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetWeekState === "confirming" && (
            <div className="rounded-lg border-2 border-red-600 bg-red-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-red-200">
                Final confirmation — this is irreversible.
              </p>
              <p className="text-xs text-red-300">
                All picks for <strong>{currentWeek?.label}</strong> will be gone forever.
                There is no undo.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetWeek}
                  disabled={resetting === "week"}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {resetting === "week" ? "Resetting…" : "DELETE ALL PICKS — CONFIRMED"}
                </button>
                <button
                  onClick={() => setResetWeekState("idle")}
                  disabled={resetting === "week"}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-red-900/40" />

        {/* Reset Entire Season */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">Reset Entire Season</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Permanently deletes all picks for every week in the {season.year} season,
                clears all results, unlocks every week, and resets the current week back to Week 1.
              </p>
            </div>
            {resetSeasonState === "idle" && (
              <button
                onClick={() => setResetSeasonState("warn")}
                className="flex-shrink-0 rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20"
              >
                Reset Season
              </button>
            )}
          </div>

          {resetSeasonState === "warn" && (
            <div className="rounded-lg border border-red-700 bg-red-900/20 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-300">
                Are you absolutely sure?
              </p>
              <p className="text-xs text-red-400">
                This will <strong>permanently delete every pick ever submitted</strong> for the{" "}
                {seasonLabel(season)}. All {season.weeks.length} weeks will be unlocked,
                all confirmed results will be cleared, and the season will rewind to Week 1.{" "}
                <strong>This cannot be undone.</strong>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResetSeasonState("confirming")}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Yes, I understand — reset the entire {season.year} season
                </button>
                <button
                  onClick={() => setResetSeasonState("idle")}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetSeasonState === "confirming" && (
            <div className="rounded-lg border-2 border-red-600 bg-red-900/30 p-4 space-y-3">
              <p className="text-sm font-bold text-red-200">
                Final confirmation — this will wipe the entire season.
              </p>
              <p className="text-xs text-red-300">
                Every pick for every week of the <strong>{seasonLabel(season)}</strong> will be
                permanently deleted. All {season.weeks.length} weeks will be reset to an unlocked,
                unconfirmed state and the current week will revert to Week 1.
                There is no undo.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetSeason}
                  disabled={resetting === "season"}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {resetting === "season" ? "Resetting…" : "RESET ENTIRE SEASON — CONFIRMED"}
                </button>
                <button
                  onClick={() => setResetSeasonState("idle")}
                  disabled={resetting === "season"}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      </> /* end overview tab */}
    </div>
  );
}

// ─── Custom Rules Tab ─────────────────────────────────────────────────────────

function CustomRulesTab({ season }: { season: SeasonSummary }) {
  const [bonusWin, setBonusWin] = useState(season.ruleFavouriteTeamBonusWin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleBonusWin() {
    const next = !bonusWin;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seasons/${season.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleFavouriteTeamBonusWin: next }),
      });
      if (res.ok) {
        setBonusWin(next);
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Rule: Favourite Team Bonus Win */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-zinc-100">Favourite Team Pick always gives a Win</h3>
              {bonusWin && (
                <span className="inline-flex rounded-full bg-purple-600/20 px-2 py-0.5 text-xs font-semibold text-purple-400">
                  Active
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              When enabled, a player&apos;s pick for their favourite team always counts as correct —
              even if that team lost. In the results screen the pick is highlighted in{" "}
              <span className="text-purple-400">purple</span> with a{" "}
              <span className="text-purple-400">TEAM PICK</span> label.
            </p>
            <p className="mt-1.5 text-xs text-zinc-600">
              Example: your favourite team is the Rams. Rams lose to 49ers, but you picked Rams —
              you still get the point. The bonus is applied when the week is confirmed.
            </p>
          </div>
          <button
            onClick={toggleBonusWin}
            disabled={saving}
            aria-label={`${bonusWin ? "Disable" : "Enable"} Favourite Team Bonus Win`}
            className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              bonusWin ? "bg-purple-600" : "bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                bonusWin ? "translate-x-8" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View C: Week Schedule Editor ────────────────────────────────────────────

function WeekScheduleEditor({
  weekId,
  seasonId,
  seasonLabel: label,
  onBack,
}: {
  weekId: string;
  seasonId: string;
  seasonLabel: string;
  onBack: () => void;
}) {
  const [week, setWeek] = useState<{ id: string; number: number; label: string; confirmedAt: string | null } | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [rows, setRows] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set of team IDs that appear more than once across all rows
  const [duplicateTeamIds, setDuplicateTeamIds] = useState<Set<string>>(new Set());
  // Number of rows to add with the bulk-add button
  const [addCount, setAddCount] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/weeks/${weekId}`)
      .then((r) => r.json())
      .then((data) => {
        setWeek(data.week);
        setAllTeams(data.allTeams ?? []);
        const existing: GameRow[] = (data.week?.games ?? []).map((g: {
          id: string;
          homeTeam: Team;
          awayTeam: Team;
          gameTime: string | null;
        }) => ({
          id: g.id,
          homeTeamId: g.homeTeam.id,
          awayTeamId: g.awayTeam.id,
          gameTime: toInputValue(g.gameTime),
        }));
        setRows(existing.length > 0 ? existing : [{ homeTeamId: "", awayTeamId: "", gameTime: "" }]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load week data");
        setLoading(false);
      });
  }, [weekId]);

  // Derive assigned + duplicate team IDs from current rows
  const assignedTeamIds = new Set(
    rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter(Boolean)
  );

  function computeDuplicates(nextRows: GameRow[]): Set<string> {
    const counts = new Map<string, number>();
    for (const r of nextRows) {
      if (r.awayTeamId) counts.set(r.awayTeamId, (counts.get(r.awayTeamId) ?? 0) + 1);
      if (r.homeTeamId) counts.set(r.homeTeamId, (counts.get(r.homeTeamId) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }

  function addRow() {
    if (rows.length >= 16) return;
    setRows((r) => [...r, { homeTeamId: "", awayTeamId: "", gameTime: "" }]);
  }

  function addRows(count: number) {
    setRows((r) => {
      const toAdd = Math.min(count, 16 - r.length);
      if (toAdd <= 0) return r;
      const newRows = Array.from({ length: toAdd }, () => ({ homeTeamId: "", awayTeamId: "", gameTime: "" }));
      return [...r, ...newRows];
    });
  }

  function removeRow(idx: number) {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    setDuplicateTeamIds(computeDuplicates(next));
  }

  function updateRow(idx: number, field: keyof GameRow, value: string) {
    const next = rows.map((row, i) => i === idx ? { ...row, [field]: value } : row);
    setRows(next);
    setDuplicateTeamIds(computeDuplicates(next));
    // Clear error when user starts fixing things
    if (duplicateTeamIds.size > 0) setError(null);
  }

  async function handleSave() {
    setError(null);

    // Validate: every row needs both teams
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.homeTeamId || !row.awayTeamId) {
        setError(`Game ${i + 1} is missing a team — fill in both home and away.`);
        return;
      }
      if (row.homeTeamId === row.awayTeamId) {
        setError(`Game ${i + 1} has the same team on both sides.`);
        return;
      }
    }

    // Validate: no team appears twice
    const dups = computeDuplicates(rows);
    if (dups.size > 0) {
      const dupNames = allTeams
        .filter((t) => dups.has(t.id))
        .map((t) => t.abbreviation)
        .join(", ");
      setDuplicateTeamIds(dups);
      setError(`These teams appear more than once this week: ${dupNames}. Each team can only play once.`);
      return;
    }

    setDuplicateTeamIds(new Set());
    setSaving(true);
    setSaved(false);

    try {
      const games = rows.map((r) => ({
        homeTeamId: r.homeTeamId,
        awayTeamId: r.awayTeamId,
        gameTime: r.gameTime ? new Date(r.gameTime + "Z").toISOString() : null,
      }));

      const res = await fetch(`/api/admin/weeks/${weekId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        const returned: GameRow[] = (data.games ?? []).map((g: {
          id: string;
          homeTeam: Team;
          awayTeam: Team;
          gameTime: string | null;
        }) => ({
          id: g.id,
          homeTeamId: g.homeTeam.id,
          awayTeamId: g.awayTeam.id,
          gameTime: toInputValue(g.gameTime),
        }));
        if (returned.length > 0) setRows(returned);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const isConfirmed = !!week?.confirmedAt;

  // Cursor: the next empty slot when clicking bye-week logos (away before home, top to bottom)
  const cursorSlot: { rowIdx: number; field: "awayTeamId" | "homeTeamId" } | null = (() => {
    if (isConfirmed) return null;
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].awayTeamId) return { rowIdx: i, field: "awayTeamId" };
      if (!rows[i].homeTeamId) return { rowIdx: i, field: "homeTeamId" };
    }
    return null;
  })();

  function handleByeTeamClick(teamId: string) {
    if (!cursorSlot || isConfirmed) return;
    updateRow(cursorSlot.rowIdx, cursorSlot.field, teamId);
  }

  // Teams on bye = allTeams not in assignedTeamIds
  const byeTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          ← {label}
        </button>
        <span className="text-zinc-600">/</span>
        <h2 className="text-xl font-bold text-zinc-50">
          {week ? week.label : "Loading…"}
        </h2>
        {isConfirmed && (
          <span className="inline-flex rounded-full bg-green-600/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
            Confirmed — read only
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-zinc-400">Loading schedule…</p>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Game rows */}
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Away Team</span>
              <span />
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Home Team</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Game Time (UTC)</span>
              <span />
            </div>

            {rows.map((row, idx) => {
              const awayIsDup = !!row.awayTeamId && duplicateTeamIds.has(row.awayTeamId);
              const homeIsDup = !!row.homeTeamId && duplicateTeamIds.has(row.homeTeamId);
              const rowHasError = awayIsDup || homeIsDup;
              const awayCursor = cursorSlot?.rowIdx === idx && cursorSlot.field === "awayTeamId";
              const homeCursor = cursorSlot?.rowIdx === idx && cursorSlot.field === "homeTeamId";

              return (
                <div
                  key={idx}
                  className={`grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    rowHasError
                      ? "border-red-600/60 bg-red-900/10"
                      : "border-zinc-800 bg-zinc-900/60"
                  }`}
                >
                  {/* Away */}
                  <select
                    value={row.awayTeamId}
                    onChange={(e) => updateRow(idx, "awayTeamId", e.target.value)}
                    disabled={isConfirmed}
                    className={`rounded-lg border px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-60 ${
                      awayIsDup
                        ? "border-red-500 bg-red-900/30 focus:border-red-400"
                        : awayCursor
                        ? "border-amber-400 bg-zinc-800 ring-1 ring-amber-400/50 focus:border-amber-400"
                        : "border-zinc-700 bg-zinc-800 focus:border-indigo-500"
                    }`}
                  >
                    <option value="">Away team…</option>
                    {allTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
                    ))}
                  </select>

                  <span className="text-sm font-bold text-zinc-500">@</span>

                  {/* Home */}
                  <select
                    value={row.homeTeamId}
                    onChange={(e) => updateRow(idx, "homeTeamId", e.target.value)}
                    disabled={isConfirmed}
                    className={`rounded-lg border px-2 py-1.5 text-sm text-zinc-100 focus:outline-none disabled:opacity-60 ${
                      homeIsDup
                        ? "border-red-500 bg-red-900/30 focus:border-red-400"
                        : homeCursor
                        ? "border-amber-400 bg-zinc-800 ring-1 ring-amber-400/50 focus:border-amber-400"
                        : "border-zinc-700 bg-zinc-800 focus:border-indigo-500"
                    }`}
                  >
                    <option value="">Home team…</option>
                    {allTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
                    ))}
                  </select>

                  {/* Game time */}
                  <input
                    type="datetime-local"
                    value={row.gameTime}
                    onChange={(e) => updateRow(idx, "gameTime", e.target.value)}
                    disabled={isConfirmed}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                  />

                  {/* Remove */}
                  {!isConfirmed && (
                    <button
                      onClick={() => removeRow(idx)}
                      className="rounded-md px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                      title="Remove game"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bye-week teams */}
          {byeTeams.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Bye Week ({byeTeams.length} team{byeTeams.length !== 1 ? "s" : ""})
                </p>
                {!isConfirmed && cursorSlot && (
                  <span className="text-xs text-amber-400">
                    ↑ click a logo to assign as {cursorSlot.field === "awayTeamId" ? "away" : "home"} team in game {cursorSlot.rowIdx + 1}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {byeTeams.map((t) => {
                  const clickable = !isConfirmed && !!cursorSlot;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={clickable ? `Assign ${t.name} → game ${(cursorSlot?.rowIdx ?? 0) + 1} ${cursorSlot?.field === "awayTeamId" ? "(away)" : "(home)"}` : t.name}
                      onClick={() => handleByeTeamClick(t.id)}
                      disabled={!clickable}
                      className={`flex flex-col items-center gap-0.5 rounded-lg p-1 transition-all ${
                        clickable
                          ? "cursor-pointer opacity-90 hover:bg-zinc-700/60 hover:opacity-100 hover:scale-110"
                          : "cursor-default opacity-40"
                      }`}
                    >
                      <img
                        src={`https://a.espncdn.com/i/teamlogos/nfl/500/${t.espnId}.png`}
                        alt={t.abbreviation}
                        className="h-8 w-8 object-contain"
                      />
                      <span className="text-[10px] text-zinc-500">{t.abbreviation}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer actions */}
          {!isConfirmed && (
            <div className="flex flex-wrap items-center gap-3">
              {rows.length < 16 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => addRows(addCount)}
                    className="rounded-l-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    + Add Game{addCount !== 1 ? `s` : ""}
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={16 - rows.length}
                    value={addCount}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(16 - rows.length, parseInt(e.target.value) || 1));
                      setAddCount(v);
                    }}
                    className="w-14 rounded-r-lg border border-l-0 border-zinc-700 bg-zinc-800 px-2 py-1.5 text-center text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    title="Number of games to add"
                  />
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || rows.length === 0}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save Schedule"}
              </button>
              {saved && <span className="text-sm text-green-400">✓ Saved</span>}
              <span className="text-xs text-zinc-500">
                {rows.length}/16 games · {byeTeams.length} on bye
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SeasonManagerContent() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [eligibleUsersCount, setEligibleUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ type: "list" });

  const fetchSeasons = useCallback(async () => {
    const res = await fetch("/api/admin/seasons");
    if (res.ok) {
      const data = await res.json();
      setSeasons(data.seasons ?? []);
      setEligibleUsersCount(data.eligibleUsersCount ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // After a PATCH (e.g. addWeek), re-fetch and stay on the same view
  async function refreshAndStay() {
    const res = await fetch("/api/admin/seasons");
    if (res.ok) {
      const data = await res.json();
      setSeasons(data.seasons ?? []);
      setEligibleUsersCount(data.eligibleUsersCount ?? 0);
    }
  }

  const currentSeason =
    view.type === "season" || view.type === "week"
      ? seasons.find((s) => s.id === (view.type === "season" ? view.seasonId : view.seasonId))
      : null;

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="seasons" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <p className="text-zinc-400">Loading…</p>
        ) : view.type === "list" ? (
          <SeasonList
            seasons={seasons}
            onRefresh={fetchSeasons}
            onNavigate={setView}
          />
        ) : view.type === "season" && currentSeason ? (
          <SeasonDetail
            season={currentSeason}
            eligibleUsersCount={eligibleUsersCount}
            onBack={() => setView({ type: "list" })}
            onNavigate={setView}
            onRefresh={async () => {
              await refreshAndStay();
            }}
          />
        ) : view.type === "week" ? (
          <WeekScheduleEditor
            weekId={view.weekId}
            seasonId={view.seasonId}
            seasonLabel={currentSeason ? seasonLabel(currentSeason) : "Season"}
            onBack={() => setView({ type: "season", seasonId: view.seasonId })}
          />
        ) : (
          <p className="text-zinc-400">Season not found.</p>
        )}
      </main>
    </div>
  );
}
