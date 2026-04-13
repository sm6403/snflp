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
  lastLoginAt: string | null;
  createdAt: string;
}

export function AdminDashboardContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [fetchUsers]);

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="users" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">
              Registered Users
            </h2>
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
      </main>
    </div>
  );
}
