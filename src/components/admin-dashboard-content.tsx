"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminToggleButton } from "./admin-toggle-button";
import { AdminCreateUser } from "./admin-create-user";
import { AdminHeader } from "./admin-header";
import { getTeamLogoUrl } from "@/lib/nfl-teams";

interface User {
  id: string;
  name: string | null;
  email: string;
  alias: string | null;
  favoriteTeam: string;
  disabled: boolean;
  showOnLeaderboard: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminAccount {
  id: string;
  username: string;
  createdAt: string;
}

// ─── Admin Accounts section (superadmin only) ────────────────────────────────

function AdminAccountsSection() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    const res = await fetch("/api/admin/admins");
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setUsername("");
        setPassword("");
        setShowForm(false);
        fetchAdmins();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(adminId: string) {
    setDeletingId(adminId);
    try {
      await fetch(`/api/admin/admins/${adminId}`, { method: "DELETE" });
      fetchAdmins();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-50">Admin Accounts</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            Admins can manage the app but cannot add or remove other admins.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            + Add Admin
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-5 rounded-lg border border-zinc-700 bg-zinc-800/60 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-100">New Admin Account</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-40">
                <label className="mb-1 block text-xs font-medium text-zinc-400">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-40">
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Password <span className="font-normal text-zinc-500">(min. 8 characters)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Admin"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); setUsername(""); setPassword(""); }}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading…</p>
      ) : admins.length === 0 ? (
        <p className="text-zinc-500">No admin accounts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {admins.map((admin) => (
                <tr key={admin.id} className="text-zinc-300">
                  <td className="px-4 py-3 font-medium text-zinc-100">{admin.username}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(admin.id)}
                      disabled={deletingId === admin.id}
                      className="rounded-md px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-40"
                    >
                      {deletingId === admin.id ? "Removing…" : "Remove"}
                    </button>
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminDashboardContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [togglingLeaderboard, setTogglingLeaderboard] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Check if current session is superadmin
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setIsSuperAdmin(d.isSuperAdmin ?? false))
      .catch(() => {});
  }, [fetchUsers]);

  async function handleLeaderboardToggle(userId: string, current: boolean) {
    setTogglingLeaderboard(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, showOnLeaderboard: !current }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, showOnLeaderboard: !current } : u)
        );
      }
    } finally {
      setTogglingLeaderboard(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="users" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* ── Regular users ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Registered Users</h2>
            <span className="text-sm text-zinc-400">
              {users.length} user{users.length !== 1 ? "s" : ""}
            </span>
          </div>
          <AdminCreateUser onCreated={fetchUsers} />
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-zinc-400">No users registered yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Alias</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Leaderboard</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((user) => (
                  <tr key={user.id} className="text-zinc-300">
                    <td className="px-4 py-3">{user.name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{user.alias || "—"}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      <div className="flex items-center gap-2">
                        <img
                          src={getTeamLogoUrl(user.favoriteTeam)}
                          alt={user.favoriteTeam}
                          className="h-6 w-6 object-contain"
                        />
                        {user.favoriteTeam}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.disabled
                            ? "bg-red-600/20 text-red-400"
                            : "bg-green-600/20 text-green-400"
                        }`}
                      >
                        {user.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleLeaderboardToggle(user.id, user.showOnLeaderboard)}
                        disabled={togglingLeaderboard === user.id}
                        title={user.showOnLeaderboard ? "Visible on leaderboard — click to hide" : "Hidden from leaderboard — click to show"}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          user.showOnLeaderboard ? "bg-indigo-600" : "bg-zinc-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            user.showOnLeaderboard ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <AdminToggleButton
                          userId={user.id}
                          initialDisabled={user.disabled}
                        />
                        <Link
                          href={`/admindash/users/${user.id}`}
                          className="rounded-md bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30"
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Admin accounts (superadmin only) ── */}
        {isSuperAdmin && <AdminAccountsSection />}
      </main>
    </div>
  );
}
