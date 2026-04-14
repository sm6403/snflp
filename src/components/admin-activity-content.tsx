"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "./admin-header";

interface LogEntry {
  id: string;
  adminName: string;
  action: string;
  detail: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; colour: string }> = {
  LOGIN:                { label: "Login",               colour: "bg-zinc-700/60 text-zinc-300" },
  LOCK_WEEK:            { label: "Lock Week",           colour: "bg-red-700/30 text-red-300" },
  UNLOCK_WEEK:          { label: "Unlock Week",         colour: "bg-yellow-700/30 text-yellow-300" },
  SET_LOCK_TIME:        { label: "Set Lock Time",       colour: "bg-indigo-700/30 text-indigo-300" },
  CLEAR_LOCK_TIME:      { label: "Clear Lock Time",     colour: "bg-zinc-700/40 text-zinc-400" },
  LOCK_PICK_SET:        { label: "Lock Picks",          colour: "bg-green-700/30 text-green-300" },
  UNLOCK_PICK_SET:      { label: "Unlock Picks",        colour: "bg-yellow-700/30 text-yellow-300" },
  EDIT_PICK:            { label: "Edit Pick",           colour: "bg-orange-700/30 text-orange-300" },
  CONFIRM_RESULTS:      { label: "Confirm Results",     colour: "bg-green-700/40 text-green-200" },
  SET_GAME_RESULT:      { label: "Set Game Result",     colour: "bg-indigo-700/30 text-indigo-300" },
  CREATE_USER:          { label: "Create User",         colour: "bg-blue-700/30 text-blue-300" },
  DELETE_USER:          { label: "Delete User",         colour: "bg-red-700/40 text-red-300" },
  UPDATE_USER:          { label: "Update User",         colour: "bg-zinc-700/40 text-zinc-300" },
  CREATE_ADMIN:         { label: "Create Admin",        colour: "bg-purple-700/30 text-purple-300" },
  DELETE_ADMIN:         { label: "Delete Admin",        colour: "bg-red-700/40 text-red-300" },
  DISABLE_ADMIN:        { label: "Disable Admin",       colour: "bg-red-700/30 text-red-300" },
  ENABLE_ADMIN:         { label: "Enable Admin",        colour: "bg-green-700/30 text-green-300" },
  CHANGE_ADMIN_PASSWORD:{ label: "Change Admin PW",     colour: "bg-purple-700/30 text-purple-300" },
};

function actionBadge(action: string) {
  const meta = ACTION_LABELS[action];
  const label = meta?.label ?? action;
  const colour = meta?.colour ?? "bg-zinc-700/40 text-zinc-400";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>
      {label}
    </span>
  );
}

function formatDetail(detail: string): string {
  try {
    const obj = JSON.parse(detail);
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
        return `${k}: ${v}`;
      })
      .join(" · ");
  } catch {
    return detail;
  }
}

const PAGE_SIZE = 50;

export function AdminActivityContent() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminFilter, setAdminFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  const fetchLogs = useCallback(async (off: number, admin: string, action: string) => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(off),
    });
    if (admin) params.set("admin", admin);
    if (action) params.set("action", action);
    const res = await fetch(`/api/admin/audit-log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setAdmins(data.admins);
      setActions(data.actions);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(0, adminFilter, actionFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(admin: string, action: string) {
    setOffset(0);
    fetchLogs(0, admin, action);
  }

  function handleAdminFilter(v: string) {
    setAdminFilter(v);
    applyFilters(v, actionFilter);
  }

  function handleActionFilter(v: string) {
    setActionFilter(v);
    applyFilters(adminFilter, v);
  }

  function goPage(newOffset: number) {
    setOffset(newOffset);
    fetchLogs(newOffset, adminFilter, actionFilter);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="activity" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Activity Log</h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              {total} event{total !== 1 ? "s" : ""} recorded
            </p>
          </div>

          {/* Filters */}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <select
              value={adminFilter}
              onChange={(e) => handleAdminFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All admins</option>
              {admins.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => handleActionFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
              ))}
            </select>
            {(adminFilter || actionFilter) && (
              <button
                onClick={() => { setAdminFilter(""); setActionFilter(""); applyFilters("", ""); }}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-6 py-12 text-center">
            <p className="text-zinc-400">No activity logged yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="text-zinc-300 hover:bg-zinc-800/20">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {entry.adminName}
                      </td>
                      <td className="px-4 py-3">
                        {actionBadge(entry.action)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatDetail(entry.detail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
                <span>
                  Page {currentPage} of {totalPages} · {total} total
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => goPage(offset - PAGE_SIZE)}
                    disabled={offset === 0}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 transition-colors hover:bg-zinc-800 disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => goPage(offset + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 transition-colors hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
