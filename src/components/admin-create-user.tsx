"use client";

import { useState } from "react";

export function AdminCreateUser({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, disabled: false }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setOpen(false);
      setError("");
      onCreated();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
      >
        Add User
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Create New User</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-900/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="name"
            type="text"
            placeholder="Name"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(""); }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
