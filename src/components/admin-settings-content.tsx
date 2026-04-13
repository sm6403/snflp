"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

interface WeekOption {
  id: string;
  number: number;
  label: string;
  isCurrent: boolean;
}

interface SeasonOption {
  id: string;
  year: number;
  type: string;
  weeks: WeekOption[];
}

interface AppSettings {
  id: string;
  mode: string;
  testSeasonId: string | null;
  testWeekId: string | null;
}

export function AdminSettingsContent() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setSeasons(data.seasons);
      if (data.settings?.testSeasonId) {
        setSelectedSeasonId(data.settings.testSeasonId);
      }
      if (data.settings?.testWeekId) {
        setSelectedWeekId(data.settings.testWeekId);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function patchSettings(updates: Partial<Omit<AppSettings, "id">>) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
      } else {
        setSettings(data.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error — could not save settings");
    }
    setSaving(false);
  }

  async function handleModeToggle() {
    if (!settings || saving) return;
    const newMode = settings.mode === "live" ? "test" : "live";
    // Optimistically update UI immediately
    setSettings((s) => s ? { ...s, mode: newMode } : s);
    await patchSettings({
      mode: newMode,
      testSeasonId: newMode === "live" ? null : selectedSeasonId || null,
      testWeekId: newMode === "live" ? null : selectedWeekId || null,
    });
  }

  async function handleSeasonChange(seasonId: string) {
    setSelectedSeasonId(seasonId);
    setSelectedWeekId("");
    await patchSettings({ testSeasonId: seasonId, testWeekId: null });
  }

  async function handleWeekChange(weekId: string) {
    setSelectedWeekId(weekId);
    await patchSettings({ testWeekId: weekId });
  }

  async function handleReset() {
    if (!selectedWeekId) return;
    setResetting(true);
    setError(null);
    setResetDone(false);
    try {
      const res = await fetch("/api/admin/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId: selectedWeekId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
      } else {
        setResetDone(true);
        setResetConfirming(false);
        setTimeout(() => setResetDone(false), 3000);
      }
    } catch {
      setError("Network error — reset failed");
    }
    setResetting(false);
  }

  const currentSeason = seasons.find((s) => s.id === selectedSeasonId);
  const currentWeek = currentSeason?.weeks.find((w) => w.id === selectedWeekId);
  const isTest = settings?.mode === "test";

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="settings" />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="mb-6 text-xl font-bold text-zinc-50">App Settings</h2>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Mode toggle */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-zinc-100">App Mode</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {isTest
                      ? "Test mode: users see the admin-selected week."
                      : "Live mode: users see the current active week."}
                  </p>
                </div>
                <button
                  onClick={handleModeToggle}
                  disabled={saving}
                  aria-label={`Switch to ${isTest ? "live" : "test"} mode`}
                  className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    isTest ? "bg-indigo-600" : "bg-zinc-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      isTest ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    !isTest
                      ? "bg-green-600/20 text-green-400"
                      : "bg-zinc-700 text-zinc-500"
                  }`}
                >
                  Live
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isTest
                      ? "bg-indigo-600/20 text-indigo-400"
                      : "bg-zinc-700 text-zinc-500"
                  }`}
                >
                  Test
                </span>
              </div>
            </div>

            {/* Test mode week selector */}
            {isTest && (
              <div className="rounded-lg border border-indigo-800 bg-indigo-900/10 p-6 space-y-4">
                <h3 className="font-medium text-zinc-100">Test Week</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Season</label>
                    <select
                      value={selectedSeasonId}
                      onChange={(e) => handleSeasonChange(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select a season…</option>
                      {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.year} {s.type === "postseason" ? "Post-Season" : "Regular Season"}
                        </option>
                      ))}
                    </select>
                  </div>
                  {currentSeason && (
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Week</label>
                      <select
                        value={selectedWeekId}
                        onChange={(e) => handleWeekChange(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Select a week…</option>
                        {currentSeason.weeks.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.label}{w.isCurrent ? " (current)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedWeekId && currentSeason && (
                    <p className="text-xs text-indigo-400">
                      Users will see {currentWeek?.label} of the {currentSeason.year} season.
                    </p>
                  )}
                </div>

                {/* Reset test week */}
                {selectedWeekId && (
                  <div className="border-t border-indigo-800/50 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">Reset Week Data</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Deletes all submitted picks, clears confirmed results, and unlocks the week.
                        </p>
                      </div>
                      {!resetConfirming ? (
                        <button
                          onClick={() => setResetConfirming(true)}
                          className="flex-shrink-0 rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20"
                        >
                          Reset
                        </button>
                      ) : (
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="text-xs text-zinc-400">Are you sure?</span>
                          <button
                            onClick={handleReset}
                            disabled={resetting}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                          >
                            {resetting ? "Resetting…" : "Yes, reset"}
                          </button>
                          <button
                            onClick={() => setResetConfirming(false)}
                            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {resetDone && (
                      <p className="mt-2 text-xs text-green-400">
                        ✓ Week reset — all picks and results cleared.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {saved && <p className="text-sm text-green-400">Settings saved.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
