"use client";

import React from "react";
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
  userLeagues?: Array<{ league: { id: string; name: string } }>;
}

interface AdminAccount {
  id: string;
  username: string;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  leagueId: string;
  league: { id: string; name: string } | null;
}

interface LeagueOption {
  id: string;
  name: string;
}

// ─── Admin Accounts section (superadmin only) ────────────────────────────────

function AdminAccountsSection() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [assigningLeagueId, setAssigningLeagueId] = useState<string | null>(null);
  // Change password state
  const [changePwId, setChangePwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changePwSaving, setChangePwSaving] = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    const [adminsRes, leaguesRes] = await Promise.all([
      fetch("/api/admin/admins"),
      fetch("/api/admin/leagues"),
    ]);
    if (adminsRes.ok) {
      const data = await adminsRes.json();
      setAdmins(data.admins ?? []);
    }
    if (leaguesRes.ok) {
      const data = await leaguesRes.json();
      setLeagues((data.leagues ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
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
        body: JSON.stringify({ username, password, leagueId: selectedLeagueId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setUsername("");
        setPassword("");
        setSelectedLeagueId("");
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

  async function handleToggleDisabled(adminId: string, current: boolean) {
    setTogglingId(adminId);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !current }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins((prev) => prev.map((a) => a.id === adminId ? { ...a, disabled: data.admin.disabled } : a));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAssignLeague(adminId: string, leagueId: string) {
    setAssigningLeagueId(adminId);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins((prev) => prev.map((a) => a.id === adminId ? { ...a, leagueId: data.admin.leagueId, league: data.admin.league } : a));
      }
    } finally {
      setAssigningLeagueId(null);
    }
  }

  async function handleChangePassword(adminId: string) {
    setChangePwSaving(true);
    setChangePwError(null);
    setChangePwSuccess(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePwError(data.error ?? `Error ${res.status}`);
      } else {
        setChangePwSuccess("Password updated.");
        setNewPassword("");
        setTimeout(() => { setChangePwId(null); setChangePwSuccess(null); }, 1500);
      }
    } catch {
      setChangePwError("Network error");
    } finally {
      setChangePwSaving(false);
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
              <div className="flex-1 min-w-40">
                <label className="mb-1 block text-xs font-medium text-zinc-400">League</label>
                <select
                  value={selectedLeagueId}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select a league…</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
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
                onClick={() => { setShowForm(false); setError(null); setUsername(""); setPassword(""); setSelectedLeagueId(""); }}
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
                <th className="px-4 py-3 font-medium">League</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {admins.map((admin) => (
                <React.Fragment key={admin.id}>
                  <tr className="text-zinc-300">
                    <td className="px-4 py-3 font-medium text-zinc-100">{admin.username}</td>
                    <td className="px-4 py-3">
                      <select
                        value={admin.leagueId ?? ""}
                        onChange={(e) => handleAssignLeague(admin.id, e.target.value)}
                        disabled={assigningLeagueId === admin.id}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                      >
                        <option value="" disabled>No league</option>
                        {leagues.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        admin.disabled
                          ? "bg-red-600/20 text-red-400"
                          : "bg-green-600/20 text-green-400"
                      }`}>
                        {admin.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {admin.lastLoginAt
                        ? new Date(admin.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleDisabled(admin.id, admin.disabled)}
                          disabled={togglingId === admin.id}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                            admin.disabled
                              ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                              : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                          }`}
                        >
                          {togglingId === admin.id ? "…" : admin.disabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          onClick={() => {
                            setChangePwId(changePwId === admin.id ? null : admin.id);
                            setNewPassword("");
                            setChangePwError(null);
                            setChangePwSuccess(null);
                          }}
                          className="rounded-md px-3 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-900/20"
                        >
                          Change Password
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          disabled={deletingId === admin.id}
                          className="rounded-md px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-40"
                        >
                          {deletingId === admin.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {changePwId === admin.id && (
                    <tr className="bg-zinc-800/40">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs text-zinc-400">New password for <span className="font-semibold text-zinc-200">{admin.username}</span>:</span>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            minLength={8}
                            autoComplete="new-password"
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                          />
                          <button
                            onClick={() => handleChangePassword(admin.id)}
                            disabled={changePwSaving || newPassword.length < 8}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
                          >
                            {changePwSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => { setChangePwId(null); setNewPassword(""); setChangePwError(null); }}
                            className="text-sm text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                          {changePwError && <span className="text-xs text-red-400">{changePwError}</span>}
                          {changePwSuccess && <span className="text-xs text-green-400">{changePwSuccess}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface JoinRequest {
  id: string;
  userId: string;
  user: { name: string | null; email: string };
  createdAt: string;
}

export function AdminDashboardContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [togglingLeaderboard, setTogglingLeaderboard] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [disabledOpen, setDisabledOpen] = useState(false);
  // League filter (superadmin only)
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [allLeaguesForFilter, setAllLeaguesForFilter] = useState<LeagueOption[]>([]);

  // Invite code & join requests
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueInviteCode, setLeagueInviteCode] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [togglingApproval, setTogglingApproval] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  const fetchLeagueData = useCallback(async () => {
    const res = await fetch("/api/admin/leagues");
    if (res.ok) {
      const data = await res.json();
      const leagues = data.leagues ?? [];
      if (leagues.length > 0) {
        setLeagueId(leagues[0].id);
        setLeagueInviteCode(leagues[0].inviteCode ?? null);
        setRequireApproval(leagues[0].requireApproval ?? false);
      }
      setAllLeaguesForFilter(leagues.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
    }
  }, []);

  const fetchJoinRequests = useCallback(async () => {
    const res = await fetch("/api/admin/join-requests");
    if (res.ok) {
      const data = await res.json();
      setJoinRequests(data.requests ?? []);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchLeagueData();
    fetchJoinRequests();
    // Check if current session is superadmin
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setIsSuperAdmin(d.isSuperAdmin ?? false))
      .catch(() => {});
  }, [fetchUsers, fetchLeagueData, fetchJoinRequests]);

  async function copyCode() {
    if (!leagueInviteCode) return;
    try {
      await navigator.clipboard.writeText(leagueInviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function handleToggleApproval() {
    if (!leagueId) return;
    setTogglingApproval(true);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApproval: !requireApproval }),
      });
      if (res.ok) {
        setRequireApproval(!requireApproval);
      }
    } finally {
      setTogglingApproval(false);
    }
  }

  async function handleJoinRequest(requestId: string, action: "approve" | "reject") {
    setProcessingRequestId(requestId);
    try {
      const res = await fetch(`/api/admin/join-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (action === "approve") fetchUsers();
      }
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    setDeletingUser(userId);
    try {
      await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setDeletingUser(null);
      setConfirmDeleteId(null);
    }
  }

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
              {users.filter((u) => !u.disabled).length} active
              {users.filter((u) => u.disabled).length > 0 && (
                <span className="ml-2 text-zinc-600">
                  · {users.filter((u) => u.disabled).length} disabled
                </span>
              )}
            </span>
          </div>
          <AdminCreateUser onCreated={fetchUsers} />
        </div>

        {/* League Invite Code (regular admins only — superadmin manages via Leagues page) */}
        {leagueInviteCode && !isSuperAdmin && (
          <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-800/60 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-400">League Invite Code</h3>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-zinc-100">{leagueInviteCode}</p>
              </div>
              <button
                onClick={copyCode}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                {codeCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-zinc-400">Require approval for new members</label>
              <button
                onClick={handleToggleApproval}
                disabled={togglingApproval}
                title={requireApproval ? "Approval required — click to allow instant join" : "Instant join — click to require approval"}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  requireApproval ? "bg-indigo-600" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    requireApproval ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Pending Join Requests (regular admins only) */}
        {joinRequests.length > 0 && !isSuperAdmin && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
            <h3 className="text-sm font-semibold text-amber-300">
              Pending Join Requests ({joinRequests.length})
            </h3>
            <div className="mt-3 space-y-2">
              {joinRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-md bg-zinc-800/60 px-4 py-2">
                  <div>
                    <span className="text-sm font-medium text-zinc-200">{req.user.name || req.user.email}</span>
                    {req.user.name && (
                      <span className="ml-2 text-xs text-zinc-500">{req.user.email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleJoinRequest(req.id, "approve")}
                      disabled={processingRequestId === req.id}
                      className="rounded-md bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30 disabled:opacity-40"
                    >
                      {processingRequestId === req.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleJoinRequest(req.id, "reject")}
                      disabled={processingRequestId === req.id}
                      className="rounded-md bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* League filter — superadmin only */}
        {isSuperAdmin && allLeaguesForFilter.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {(["all", "unassigned", ...allLeaguesForFilter.map((l) => l.id)] as string[]).map((key) => {
              const label =
                key === "all" ? "All" :
                key === "unassigned" ? "Unassigned" :
                (allLeaguesForFilter.find((l) => l.id === key)?.name ?? key);
              const count =
                key === "all" ? users.length :
                key === "unassigned" ? users.filter((u) => !u.userLeagues || u.userLeagues.length === 0).length :
                users.filter((u) => u.userLeagues?.some((ul) => ul.league.id === key)).length;
              const active = leagueFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setLeagueFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 ${active ? "text-indigo-200" : "text-zinc-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {(() => {
          const filteredUsers = isSuperAdmin
            ? leagueFilter === "all"
              ? users
              : leagueFilter === "unassigned"
              ? users.filter((u) => !u.userLeagues || u.userLeagues.length === 0)
              : users.filter((u) => u.userLeagues?.some((ul) => ul.league.id === leagueFilter))
            : users;
          const activeUsers = filteredUsers.filter((u) => !u.disabled);
          const disabledUsers = filteredUsers.filter((u) => u.disabled);

          function renderRows(list: User[]) {
            return list.map((user) => (
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
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-zinc-400">
                    {user.userLeagues && user.userLeagues.length > 0
                      ? user.userLeagues.map((ul) => ul.league.name).join(", ")
                      : <span className="text-zinc-600 italic">None</span>}
                  </td>
                )}
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
                    {confirmDeleteId === user.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deletingUser === user.id}
                          className="rounded-md bg-red-600/30 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/50 disabled:opacity-40"
                        >
                          {deletingUser === user.id ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(user.id)}
                        className="rounded-md px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ));
          }

          const tableHead = (
            <thead className="bg-zinc-800/50 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Alias</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Leaderboard</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                {isSuperAdmin && <th className="px-4 py-3 font-medium">League</th>}
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
          );

          if (loading) return <p className="text-zinc-400">Loading...</p>;
          if (users.length === 0) return <p className="text-zinc-400">No users registered yet.</p>;

          return (
            <>
              {/* Active users table */}
              {activeUsers.length === 0 ? (
                <p className="text-zinc-500 text-sm">No active users.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-sm">
                    {tableHead}
                    <tbody className="divide-y divide-zinc-800">
                      {renderRows(activeUsers)}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Disabled users — collapsible */}
              {disabledUsers.length > 0 && (
                <div className="mt-4 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setDisabledOpen((o) => !o)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800/40"
                  >
                    <span className="text-sm font-medium text-zinc-400">
                      Disabled accounts
                      <span className="ml-2 rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                        {disabledUsers.length}
                      </span>
                    </span>
                    <svg
                      className={`h-4 w-4 text-zinc-500 transition-transform ${disabledOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {disabledOpen && (
                    <div className="border-t border-zinc-800">
                      <table className="w-full text-left text-sm">
                        {tableHead}
                        <tbody className="divide-y divide-zinc-800">
                          {renderRows(disabledUsers)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* ── Admin accounts (superadmin only) ── */}
        {isSuperAdmin && <AdminAccountsSection />}
      </main>
    </div>
  );
}
