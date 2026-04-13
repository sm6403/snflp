"use client";

import { useState } from "react";

export function AliasEditor({ initialAlias }: { initialAlias: string }) {
  const [alias, setAlias] = useState(initialAlias);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialAlias);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/user/alias", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: inputValue }),
    });

    if (res.ok) {
      setAlias(inputValue);
      setEditing(false);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Alias
      </h3>

      {editing ? (
        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your alias"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Saving..." : "Submit"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setInputValue(alias);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {alias || <span className="text-zinc-400 font-normal">No alias set</span>}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
