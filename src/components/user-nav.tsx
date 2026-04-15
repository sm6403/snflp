import Link from "next/link";
import { LeagueSwitcher } from "@/components/league-switcher";

interface UserNavProps {
  active: "dashboard" | "leaderboard" | "settings";
  activeLeagueId?: string | null;
}

export function UserNav({ active, activeLeagueId }: UserNavProps) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

  const linkClass = (page: UserNavProps["active"]) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active === page
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
    }`;

  return (
    <nav className="flex items-center gap-1">
      <LeagueSwitcher activeLeagueId={activeLeagueId} />
      <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <Link href="/dashboard" className={linkClass("dashboard")}>
        Dashboard
      </Link>
      <Link href="/leaderboard" className={linkClass("leaderboard")}>
        Leaderboard
      </Link>
      <Link href="/settings" className={linkClass("settings")}>
        Settings
      </Link>
      <span
        title="Deployed commit hash"
        className="ml-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-600"
      >
        {version}
      </span>
    </nav>
  );
}
