"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

interface AppSettings {
  id: string;
  mode: string;
  emailRemindersEnabled: boolean;
  reminderDayOfWeek: number;
  reminderHourUtc: number;
  reminderMinuteUtc: number;
  reminderOnlyUnsubmitted: boolean;
  newUsersStartDisabled: boolean;
}

type BulkLockState = "idle" | "locking" | "unlocking";
type TestEmailState = "idle" | "sending" | "sent" | "error";

// ─── Admin password change ────────────────────────────────────────────────────

function AdminPasswordSection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (isSuperAdmin) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
        <h3 className="font-medium text-zinc-100">Change Password</h3>
        <p className="mt-2 text-sm text-zinc-500">
          The superadmin password is set via environment variables and cannot be changed here.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (next !== confirm) {
      setStatus({ type: "error", msg: "New passwords do not match." });
      return;
    }
    if (next.length < 8) {
      setStatus({ type: "error", msg: "New password must be at least 8 characters." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ type: "success", msg: "Password changed successfully." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setStatus({ type: "error", msg: d.error ?? "Failed to change password." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
      <h3 className="mb-4 font-medium text-zinc-100">Change Password</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-600">Minimum 8 characters.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {status && (
          <p className={`text-sm ${status.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {status.msg}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={saving || !current || !next || !confirm}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Change Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminSettingsContent() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLockState, setBulkLockState] = useState<BulkLockState>("idle");
  const [bulkLockMsg, setBulkLockMsg] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailState, setTestEmailState] = useState<TestEmailState>("idle");
  const [testEmailMsg, setTestEmailMsg] = useState<string | null>(null);
  // Schedule form — local draft state, saved explicitly with "Save Schedule"
  const [schedDay, setSchedDay] = useState(4);
  const [schedHour, setSchedHour] = useState(12);
  const [schedMinute, setSchedMinute] = useState(0);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setIsSuperAdmin(data.isSuperAdmin ?? false);
      // Seed local schedule draft from DB values
      if (data.settings) {
        setSchedDay(data.settings.reminderDayOfWeek ?? 4);
        setSchedHour(data.settings.reminderHourUtc ?? 12);
        setSchedMinute(data.settings.reminderMinuteUtc ?? 0);
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

  async function handleRemindersToggle() {
    if (!settings || saving) return;
    const newVal = !settings.emailRemindersEnabled;
    setSettings((s) => s ? { ...s, emailRemindersEnabled: newVal } : s);
    await patchSettings({ emailRemindersEnabled: newVal });
  }

  async function handleTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestEmailState("sending");
    setTestEmailMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "testEmail", testEmailAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailState("sent");
        setTestEmailMsg(`Test email sent to ${data.sentTo}`);
        setTimeout(() => { setTestEmailState("idle"); setTestEmailMsg(null); }, 5000);
      } else {
        setTestEmailState("error");
        setTestEmailMsg(data.error ?? "Failed to send test email");
      }
    } catch {
      setTestEmailState("error");
      setTestEmailMsg("Network error");
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSchedSaving(true);
    setSchedSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderDayOfWeek: schedDay,
          reminderHourUtc: schedHour,
          reminderMinuteUtc: schedMinute,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setSchedSaved(true);
        setTimeout(() => setSchedSaved(false), 2500);
      } else {
        setError(data.error ?? "Failed to save schedule");
      }
    } catch {
      setError("Network error");
    } finally {
      setSchedSaving(false);
    }
  }

  async function handleUnsubmittedToggle() {
    if (!settings || saving) return;
    const newVal = !settings.reminderOnlyUnsubmitted;
    setSettings((s) => s ? { ...s, reminderOnlyUnsubmitted: newVal } : s);
    await patchSettings({ reminderOnlyUnsubmitted: newVal });
  }

  async function handleNewUsersDisabledToggle() {
    if (!settings || saving) return;
    const newVal = !settings.newUsersStartDisabled;
    setSettings((s) => s ? { ...s, newUsersStartDisabled: newVal } : s);
    await patchSettings({ newUsersStartDisabled: newVal });
  }

  async function handleBulkFavoriteLock(locked: boolean) {
    setBulkLockState(locked ? "locking" : "unlocking");
    setBulkLockMsg(null);
    try {
      const res = await fetch("/api/admin/users/bulk-favorite-lock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkLockMsg(data.error ?? "Failed");
      } else {
        setBulkLockMsg(`${locked ? "Locked" : "Unlocked"} favourite team for ${data.updated} user${data.updated !== 1 ? "s" : ""}.`);
        setTimeout(() => setBulkLockMsg(null), 4000);
      }
    } catch {
      setBulkLockMsg("Network error");
    } finally {
      setBulkLockState("idle");
    }
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

            {/* New user registration */}
            {isSuperAdmin && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-zinc-100">New Account Registration</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {settings?.newUsersStartDisabled
                        ? "New accounts start disabled — an admin must manually activate them before they can log in."
                        : "New accounts start active and can log in immediately after signing up."}
                    </p>
                  </div>
                  <button
                    onClick={handleNewUsersDisabledToggle}
                    disabled={saving}
                    aria-label={`${settings?.newUsersStartDisabled ? "Allow new accounts to start active" : "Require admin activation for new accounts"}`}
                    className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      settings?.newUsersStartDisabled ? "bg-amber-600" : "bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings?.newUsersStartDisabled ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {settings?.newUsersStartDisabled && (
                  <p className="mt-3 text-xs text-amber-400/80">
                    ⚠ New sign-ups will be inactive until enabled in the Users panel.
                  </p>
                )}
              </div>
            )}

            {/* Favourite team bulk lock */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
              <h3 className="font-medium text-zinc-100">Favourite Team Picks</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Lock or unlock the ability for all users to change their favourite team. Locked users see a 🔒 badge and cannot edit their pick until unlocked.
              </p>
              {bulkLockMsg && (
                <p className="mt-3 text-sm text-green-400">{bulkLockMsg}</p>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleBulkFavoriteLock(true)}
                  disabled={bulkLockState !== "idle"}
                  className="rounded-lg bg-amber-600/20 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-600/30 disabled:opacity-50"
                >
                  {bulkLockState === "locking" ? "Locking..." : "🔒 Lock All"}
                </button>
                <button
                  onClick={() => handleBulkFavoriteLock(false)}
                  disabled={bulkLockState !== "idle"}
                  className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  {bulkLockState === "unlocking" ? "Unlocking..." : "🔓 Unlock All"}
                </button>
              </div>
            </div>

            {saved && <p className="text-sm text-green-400">Settings saved.</p>}

            {/* Email reminders */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6 space-y-5">
              {/* Master on/off toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-zinc-100">Email Reminders</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {settings?.emailRemindersEnabled
                      ? "Enabled — users with reminders on will receive emails."
                      : "Disabled — no reminder emails will be sent to anyone."}
                  </p>
                </div>
                <button
                  onClick={handleRemindersToggle}
                  disabled={saving}
                  aria-label={`${settings?.emailRemindersEnabled ? "Disable" : "Enable"} email reminders`}
                  className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    settings?.emailRemindersEnabled ? "bg-indigo-600" : "bg-zinc-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings?.emailRemindersEnabled ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Scheduled reminder time */}
              <div className="border-t border-zinc-700/60 pt-5">
                <p className="mb-1 text-sm font-medium text-zinc-300">Weekly reminder schedule</p>
                <p className="mb-3 text-xs text-zinc-500">
                  One reminder email per week sent at this UTC time. The cron runs every 15 minutes, so pick a time on the quarter-hour or leave minutes at 00.
                </p>
                <form onSubmit={handleSaveSchedule} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Day</label>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(Number(e.target.value))}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    >
                      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Hour (UTC)</label>
                    <select
                      value={schedHour}
                      onChange={(e) => setSchedHour(Number(e.target.value))}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Minute</label>
                    <select
                      value={schedMinute}
                      onChange={(e) => setSchedMinute(Number(e.target.value))}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>:{String(m).padStart(2, "0")}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={schedSaving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {schedSaving ? "Saving…" : "Save Schedule"}
                  </button>
                  {schedSaved && <span className="text-sm text-green-400">Saved ✓</span>}
                </form>
              </div>

              {/* Only unsubmitted toggle */}
              <div className="border-t border-zinc-700/60 pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Only email users who haven't submitted picks</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {settings?.reminderOnlyUnsubmitted
                        ? "Only users with no locked pick set this week will be emailed."
                        : "All users with reminders enabled will be emailed regardless of pick status."}
                    </p>
                  </div>
                  <button
                    onClick={handleUnsubmittedToggle}
                    disabled={saving}
                    aria-label={`${settings?.reminderOnlyUnsubmitted ? "Email everyone" : "Only email unsubmitted"}`}
                    className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      settings?.reminderOnlyUnsubmitted ? "bg-indigo-600" : "bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settings?.reminderOnlyUnsubmitted ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Test email sub-section */}
              <div className="border-t border-zinc-700/60 pt-5">
                <p className="mb-3 text-sm font-medium text-zinc-300">Send a test email</p>
                <form onSubmit={handleTestEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email address</label>
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={testEmailState === "sending" || !testEmailAddress.trim()}
                    className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {testEmailState === "sending" ? "Sending…" : "Send Test"}
                  </button>
                </form>
                {testEmailMsg && (
                  <p className={`mt-2 text-sm ${testEmailState === "sent" ? "text-green-400" : "text-red-400"}`}>
                    {testEmailMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Admin password change */}
            <AdminPasswordSection isSuperAdmin={isSuperAdmin} />
          </div>
        )}
      </main>
    </div>
  );
}
