"use client";

import { useState } from "react";
import { getTeamColors } from "@/lib/nfl-team-colors";
import { getTeamLogoUrl } from "@/lib/nfl-teams";

// ─── Reusable section card ────────────────────────────────────────────────────

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-6">
      <h3 className="mb-4 font-semibold text-zinc-100">{title}</h3>
      {children}
    </div>
  );
}

// ─── Status message ───────────────────────────────────────────────────────────

function StatusMsg({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <p className={`mt-2 text-sm ${type === "success" ? "text-green-400" : "text-red-400"}`}>
      {msg}
    </p>
  );
}

// ─── Alias section ────────────────────────────────────────────────────────────

function AliasSection({ initialAlias }: { initialAlias: string }) {
  const [alias, setAlias] = useState(initialAlias);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/alias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim() }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "Display name updated." });
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to update." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Display Name">
      <p className="mb-4 text-sm text-zinc-400">
        This is the name you appear as in the leaderboards.
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Display name</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            maxLength={32}
            placeholder="e.g. ScottM"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving || alias.trim() === initialAlias}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {status && <StatusMsg {...status} />}
    </SettingsCard>
  );
}

// ─── Email section ────────────────────────────────────────────────────────────

function EmailSection({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "Email address updated. Sign in again if prompted." });
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to update." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Email Address">
      <form onSubmit={handleSave} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving || email.trim() === initialEmail}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {status && <StatusMsg {...status} />}
    </SettingsCard>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
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
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "Password changed successfully." });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to change password." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Change Password">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
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
        {status && <StatusMsg {...status} />}
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
    </SettingsCard>
  );
}

// ─── Email reminders section ──────────────────────────────────────────────────

function EmailRemindersSection({ initialEmailReminders }: { initialEmailReminders: boolean }) {
  const [enabled, setEnabled] = useState(initialEmailReminders);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function toggle() {
    const newVal = !enabled;
    setEnabled(newVal); // optimistic
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailReminders: newVal }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: newVal ? "Email reminders enabled." : "Email reminders disabled." });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setEnabled(!newVal); // revert
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to update." });
      }
    } catch {
      setEnabled(!newVal); // revert
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Email Reminders">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          Receive reminder emails before the weekly picks deadline.
        </p>
        <button
          onClick={toggle}
          disabled={saving}
          aria-label={`${enabled ? "Disable" : "Enable"} email reminders`}
          className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-indigo-600" : "bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {status && <StatusMsg {...status} />}
    </SettingsCard>
  );
}

// ─── Team colour theme section ────────────────────────────────────────────────

function TeamThemeSection({
  initialFavoriteTeam,
  initialTeamTheme,
}: {
  initialFavoriteTeam: string;
  initialTeamTheme: string | null;
}) {
  const colors = getTeamColors(initialFavoriteTeam);
  const [activeTheme, setActiveTheme] = useState<string | null>(initialTeamTheme);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (!colors) return null;

  const isActive = activeTheme === colors.espnId;

  async function handleSet() {
    if (!colors) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/team-theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamTheme: colors.espnId }),
      });
      if (res.ok) {
        setActiveTheme(colors.espnId);
        setStatus({ type: "success", msg: "Theme applied! Reloading…" });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to apply theme." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/team-theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamTheme: null }),
      });
      if (res.ok) {
        setActiveTheme(null);
        setStatus({ type: "success", msg: "Theme reset. Reloading…" });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setStatus({ type: "error", msg: d.error ?? "Failed to reset theme." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Team Colour Theme">
      <p className="mb-4 text-sm text-zinc-400">
        Apply your favourite team&apos;s official colours as the app accent. Affects buttons,
        toggles, active states, and focus rings everywhere.
      </p>

      {/* Team preview */}
      <div className="mb-4 flex items-center gap-3">
        <img
          src={getTeamLogoUrl(initialFavoriteTeam)}
          alt={initialFavoriteTeam}
          className="h-10 w-10 object-contain"
        />
        <div>
          <p className="text-sm font-medium text-zinc-100">{initialFavoriteTeam}</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border border-zinc-600"
              style={{ backgroundColor: colors.primary }}
              title={colors.primary}
            />
            <span className="text-xs text-zinc-500">{colors.primary}</span>
            <span
              className="h-4 w-4 rounded-full border border-zinc-600 ml-1"
              style={{ backgroundColor: colors.hover }}
              title={colors.hover}
            />
            <span className="text-xs text-zinc-500">{colors.hover}</span>
          </div>
        </div>
      </div>

      {/* Active badge */}
      {isActive && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Theme active
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!isActive ? (
          <button
            onClick={handleSet}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Applying…" : "Set Theme"}
          </button>
        ) : (
          <button
            onClick={handleReset}
            disabled={saving}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Resetting…" : "Reset Theme"}
          </button>
        )}
      </div>

      {status && <StatusMsg {...status} />}
    </SettingsCard>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function UserSettingsContent({
  initialAlias,
  initialEmail,
  initialEmailReminders,
  initialFavoriteTeam,
  initialTeamTheme,
}: {
  initialAlias: string;
  initialEmail: string;
  initialEmailReminders: boolean;
  initialFavoriteTeam: string;
  initialTeamTheme: string | null;
}) {
  return (
    <div className="space-y-4">
      <AliasSection initialAlias={initialAlias} />
      <EmailSection initialEmail={initialEmail} />
      <PasswordSection />
      <EmailRemindersSection initialEmailReminders={initialEmailReminders} />
      <TeamThemeSection
        initialFavoriteTeam={initialFavoriteTeam}
        initialTeamTheme={initialTeamTheme}
      />
    </div>
  );
}
