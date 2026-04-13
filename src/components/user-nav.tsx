import Link from "next/link";

interface UserNavProps {
  active: "dashboard" | "leaderboard";
}

export function UserNav({ active }: UserNavProps) {
  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/dashboard"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "dashboard"
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Dashboard
      </Link>
      <Link
        href="/leaderboard"
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "leaderboard"
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Leaderboard
      </Link>
    </nav>
  );
}
