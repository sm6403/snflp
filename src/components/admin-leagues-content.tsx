"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

interface League {
  id: string;
  name: string;
  createdAt: string;
  inviteCode: string | null;
  requireApproval: boolean;
  _count: { userLeagues: number; seasons: number };
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  alias: string | null;
  joinedAt: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  alias: string | null;
}

export default function AdminLeaguesContent() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Create league form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Expanded league state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // All users for add-member dropdown
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Context switch
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<string | null>(null);

  // Invite code
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    const res = await fetch("/api/admin/leagues");
    if (res.ok) {
      const data = await res.json();
      setLeagues(data.leagues ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeagues();
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setIsSuperAdmin(d.isSuperAdmin ?? false))
      .catch(() => {});
  }, [fetchLeagues]);

  // Fetch members when a league is expanded
  const fetchMembers = useCallback(async (leagueId: string) => {
    setMembersLoading(true);
    const res = await fetch(`/api/admin/leagues/${leagueId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
    setMembersLoading(false);
  }, []);

  // Fetch all users for the add-member dropdown
  const fetchAllUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setAllUsers(
        (data.users ?? []).map((u: UserOption) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          alias: u.alias,
        }))
      );
    }
  }, []);

  function handleExpand(leagueId: string) {
    if (expandedId === leagueId) {
      setExpandedId(null);
      setMembers([]);
      return;
    }
    setExpandedId(leagueId);
    setAddUserId("");
    fetchMembers(leagueId);
    fetchAllUsers();
  }

  // Create league
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? `Error ${res.status}`);
      } else {
        setNewName("");
        fetchLeagues();
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }

  // Rename league
  async function handleRename(leagueId: string) {
    if (!editName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        setLeagues((prev) =>
          prev.map((l) =>
            l.id === leagueId ? { ...l, name: editName.trim() } : l
          )
        );
        setEditingId(null);
      }
    } finally {
      setRenaming(false);
    }
  }

  // Add member
  async function handleAddMember(leagueId: string) {
    if (!addUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId }),
      });
      if (res.ok) {
        setAddUserId("");
        fetchMembers(leagueId);
        fetchLeagues(); // update counts
      }
    } finally {
      setAddingMember(false);
    }
  }

  // Remove member
  async function handleRemoveMember(leagueId: string, userId: string) {
    setRemovingMemberId(userId);
    try {
      const res = await fetch(
        `/api/admin/leagues/${leagueId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
        fetchLeagues(); // update counts
      }
    } finally {
      setRemovingMemberId(null);
    }
  }

  // Switch context
  async function handleSwitchContext(leagueId: string, leagueName: string) {
    setSwitchingId(leagueId);
    setSwitchSuccess(null);
    try {
      const res = await fetch("/api/admin/leagues/set-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });
      if (res.ok) {
        setSwitchSuccess(leagueName);
        setTimeout(() => setSwitchSuccess(null), 2000);
      }
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleRegenerateCode(leagueId: string) {
    setRegeneratingId(leagueId);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/regenerate-code`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLeagues((prev) =>
          prev.map((l) =>
            l.id === leagueId ? { ...l, inviteCode: data.inviteCode } : l
          )
        );
      }
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleCopyCode(leagueId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(leagueId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch { /* ignore */ }
  }

  // Users not yet in the expanded league
  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.id === u.id)
  );

  if (!isSuperAdmin && !loading) {
    return (
      <div className="min-h-screen bg-zinc-900">
        <AdminHeader active="leagues" />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-zinc-400">
            Only superadmins can manage leagues.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="leagues" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Leagues</h2>
            <span className="text-sm text-zinc-400">
              {leagues.length} league{leagues.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Switch success banner */}
        {switchSuccess && (
          <div className="mb-4 rounded-lg border border-green-700 bg-green-600/20 px-4 py-2 text-sm text-green-400">
            Switched league context to <span className="font-semibold">{switchSuccess}</span>
          </div>
        )}

        {/* Create league form */}
        <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/60 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-100">
            Create New League
          </h3>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-40">
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                League Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create League"}
            </button>
          </form>
          {createError && (
            <p className="mt-2 text-sm text-red-400">{createError}</p>
          )}
        </div>

        {/* Leagues list */}
        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : leagues.length === 0 ? (
          <p className="text-zinc-500">No leagues yet.</p>
        ) : (
          <div className="space-y-4">
            {leagues.map((league) => (
              <div
                key={league.id}
                className="rounded-lg border border-zinc-800 bg-zinc-800/40"
              >
                {/* League card header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    {editingId === league.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(league.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleRename(league.id)}
                          disabled={renaming}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {renaming ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(league.id);
                          setEditName(league.name);
                        }}
                        title="Click to rename"
                        className="text-base font-semibold text-zinc-100 hover:text-indigo-400 transition-colors"
                      >
                        {league.name}
                      </button>
                    )}
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {league._count.userLeagues} member
                        {league._count.userLeagues !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {league._count.seasons} season
                        {league._count.seasons !== 1 ? "s" : ""}
                      </span>
                      <span>
                        Created{" "}
                        {new Date(league.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {league.inviteCode && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Invite Code:</span>
                        <span className="font-mono text-sm font-semibold tracking-widest text-zinc-200">{league.inviteCode}</span>
                        <button
                          onClick={() => handleCopyCode(league.id, league.inviteCode!)}
                          className="rounded px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                        >
                          {copiedCodeId === league.id ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={() => handleRegenerateCode(league.id)}
                          disabled={regeneratingId === league.id}
                          className="rounded px-2 py-0.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/20 disabled:opacity-40"
                        >
                          {regeneratingId === league.id ? "Regenerating..." : "Regenerate"}
                        </button>
                        {league.requireApproval && (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                            Approval required
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSwitchContext(league.id, league.name)}
                      disabled={switchingId === league.id}
                      className="rounded-md bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30 disabled:opacity-40"
                    >
                      {switchingId === league.id
                        ? "Switching..."
                        : "Switch to this league"}
                    </button>
                    <button
                      onClick={() => handleExpand(league.id)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        expandedId === league.id
                          ? "bg-zinc-600 text-zinc-200"
                          : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {expandedId === league.id ? "Collapse" : "Members"}
                    </button>
                  </div>
                </div>

                {/* Expanded members section */}
                {expandedId === league.id && (
                  <div className="border-t border-zinc-700 px-5 py-4">
                    {membersLoading ? (
                      <p className="text-sm text-zinc-400">
                        Loading members...
                      </p>
                    ) : (
                      <>
                        {/* Members table */}
                        {members.length === 0 ? (
                          <p className="mb-4 text-sm text-zinc-500">
                            No members in this league yet.
                          </p>
                        ) : (
                          <div className="mb-4 overflow-hidden rounded-lg border border-zinc-700">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-zinc-800/50 text-zinc-400">
                                <tr>
                                  <th className="px-4 py-2 font-medium">
                                    Name
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Alias
                                  </th>
                                  <th className="px-4 py-2 font-medium">
                                    Email
                                  </th>
                                  <th className="px-4 py-2 font-medium text-right">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-700">
                                {members.map((member) => (
                                  <tr
                                    key={member.id}
                                    className="text-zinc-300"
                                  >
                                    <td className="px-4 py-2">
                                      {member.name || "\u2014"}
                                    </td>
                                    <td className="px-4 py-2 text-zinc-400">
                                      {member.alias || "\u2014"}
                                    </td>
                                    <td className="px-4 py-2">
                                      {member.email}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <button
                                        onClick={() =>
                                          handleRemoveMember(
                                            league.id,
                                            member.id
                                          )
                                        }
                                        disabled={
                                          removingMemberId === member.id
                                        }
                                        className="rounded-md px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-40"
                                      >
                                        {removingMemberId === member.id
                                          ? "Removing..."
                                          : "Remove"}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add member section */}
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-48">
                            <label className="mb-1 block text-xs font-medium text-zinc-400">
                              Add Member
                            </label>
                            <select
                              value={addUserId}
                              onChange={(e) => setAddUserId(e.target.value)}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="">Select a user...</option>
                              {availableUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name || u.alias || u.email} ({u.email})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => handleAddMember(league.id)}
                            disabled={!addUserId || addingMember}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {addingMember ? "Adding..." : "Add"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
