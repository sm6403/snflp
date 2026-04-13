"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

interface AppSettings {
  id: string;
  mode: string;
}

export function AdminSettingsContent() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
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
    } finally {
      setSaving(false);
    }
  }

  async function handleModeToggle() {
    if (!settings || saving) return;
    const newMode = settings.mode === "live" ? "test" : "live";
    setSettings((s) => s ? { ...s, mode: newMode } : s);
    await patchSettings({ mode: newMode });
  }

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

            {saved && <p className="text-sm text-green-400">Settings saved.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
