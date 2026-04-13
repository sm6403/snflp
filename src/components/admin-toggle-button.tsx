"use client";

import { useState } from "react";

export function AdminToggleButton({
  userId,
  initialDisabled,
}: {
  userId: string;
  initialDisabled: boolean;
}) {
  const [disabled, setDisabled] = useState(initialDisabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, disabled: !disabled }),
    });

    if (res.ok) {
      setDisabled(!disabled);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        disabled
          ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
          : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
      }`}
    >
      {loading ? "..." : disabled ? "Enable" : "Disable"}
    </button>
  );
}
