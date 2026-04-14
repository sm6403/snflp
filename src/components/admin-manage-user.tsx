"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLogoutButton } from "./admin-logout-button";
import { NFL_TEAMS, getTeamLogoUrl } from "@/lib/nfl-teams";

interface User {
  id: string;
  name: string | null;
  email: string;
  alias: string | null;
  favoriteTeam: string;
  favoriteTeamLocked: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function AdminManageUser({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  async function handleUpdate(field: string, value: unknown) {
    setMessage("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setMessage("Updated successfully");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900">
        <p className="text-red-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admindash"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              &larr; Back
            </Link>
            <h1 className="text-lg font-semibold text-zinc-50">
              Manage User
            </h1>
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        {message && (
          <div className="rounded-lg bg-green-900/30 p-3 text-sm text-green-400">
            {message}
          </div>
        )}

        {/* User info header */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-50">
                {user.name || user.email}
              </h2>
              <p className="text-sm text-zinc-400">{user.email}</p>
              {user.alias && (
                <p className="text-sm text-zinc-500">Alias: {user.alias}</p>
              )}
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                user.disabled
                  ? "bg-red-600/20 text-red-400"
                  : "bg-green-600/20 text-green-400"
              }`}
            >
              {user.disabled ? "Disabled" : "Active"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Team:</span>{" "}
              <span className="text-zinc-300">{user.favoriteTeam}</span>
            </div>
            <div>
              <span className="text-zinc-500">Last Login:</span>{" "}
              <span className="text-zinc-300">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString()
                  : "Never"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Created:</span>{" "}
              <span className="text-zinc-300">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Toggle account status */}
        <Section title="Account Status">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {user.disabled
                ? "This account is currently disabled."
                : "This account is currently active."}
            </p>
            <button
              onClick={() => handleUpdate("disabled", !user.disabled)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                user.disabled
                  ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                  : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
              }`}
            >
              {user.disabled ? "Enable Account" : "Disable Account"}
            </button>
          </div>
        </Section>

        {/* Set Password */}
        <Section title="Set Password">
          <PasswordForm onSubmit={(pw) => handleUpdate("password", pw)} />
        </Section>

        {/* Edit Alias */}
        <Section title="Alias">
          <AliasForm
            initialAlias={user.alias || ""}
            onSubmit={(alias) => handleUpdate("alias", alias)}
          />
        </Section>

        {/* Edit Name */}
        <Section title="Display Name">
          <NameForm
            initialName={user.name || ""}
            onSubmit={(name) => handleUpdate("name", name)}
          />
        </Section>

        {/* Favourite Team */}
        <Section title="Favourite Team">
          <FavoriteTeamForm
            currentTeam={user.favoriteTeam}
            locked={user.favoriteTeamLocked}
            onChangeTeam={(team) => handleUpdate("favoriteTeam", team)}
            onToggleLock={() => handleUpdate("favoriteTeamLocked", !user.favoriteTeamLocked)}
          />
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 p-6">
      <h3 className="mb-4 text-sm font-semibold text-zinc-300">{title}</h3>
      {children}
    </div>
  );
}

function PasswordForm({ onSubmit }: { onSubmit: (pw: string) => void }) {
  const [password, setPassword] = useState("");

  return (
    <div className="flex gap-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 6 chars)"
        minLength={6}
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <button
        onClick={() => {
          if (password.length >= 6) {
            onSubmit(password);
            setPassword("");
          }
        }}
        disabled={password.length < 6}
        className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        Set Password
      </button>
    </div>
  );
}

function AliasForm({
  initialAlias,
  onSubmit,
}: {
  initialAlias: string;
  onSubmit: (alias: string) => void;
}) {
  const [alias, setAlias] = useState(initialAlias);

  return (
    <div className="flex gap-3">
      <input
        type="text"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="User alias"
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <button
        onClick={() => onSubmit(alias)}
        className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
      >
        Save Alias
      </button>
    </div>
  );
}

function NameForm({
  initialName,
  onSubmit,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div className="flex gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name"
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <button
        onClick={() => onSubmit(name)}
        className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
      >
        Save Name
      </button>
    </div>
  );
}

function FavoriteTeamForm({
  currentTeam,
  locked,
  onChangeTeam,
  onToggleLock,
}: {
  currentTeam: string;
  locked: boolean;
  onChangeTeam: (team: string) => void;
  onToggleLock: () => void;
}) {
  const [selected, setSelected] = useState(currentTeam);

  // Keep local select in sync when the parent value changes after a save
  if (selected !== currentTeam) {
    setSelected(currentTeam);
  }

  return (
    <div className="space-y-4">
      {/* Current team display */}
      <div className="flex items-center gap-3">
        <img
          src={getTeamLogoUrl(currentTeam)}
          alt={currentTeam}
          className="h-10 w-10 object-contain"
        />
        <div className="flex-1">
          <p className="font-medium text-zinc-100">{currentTeam}</p>
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            🔒 Locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/50 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
            🔓 Unlocked
          </span>
        )}
      </div>

      {/* Change team */}
      <div className="flex gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
        >
          {NFL_TEAMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={() => onChangeTeam(selected)}
          disabled={selected === currentTeam}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          Save Team
        </button>
      </div>

      {/* Lock toggle */}
      <div className="flex items-center justify-between rounded-md border border-zinc-700/50 bg-zinc-800/50 px-4 py-3">
        <p className="text-sm text-zinc-400">
          {locked
            ? "User cannot change their favourite team."
            : "User can change their favourite team."}
        </p>
        <button
          onClick={onToggleLock}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            locked
              ? "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700"
              : "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
          }`}
        >
          {locked ? "🔓 Unlock" : "🔒 Lock"}
        </button>
      </div>
    </div>
  );
}
