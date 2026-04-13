"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admindash/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
    >
      Logout
    </button>
  );
}
