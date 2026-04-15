import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { UserNav } from "@/components/user-nav";
import { LeaderboardTabs } from "./leaderboard-tabs";
import { resolveUserLeagueId } from "@/lib/league-context";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const leagueId = await resolveUserLeagueId(session.user.id);

  if (!leagueId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">No League Found</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are not a member of any league yet. Please contact your league administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              SNFLP
            </h1>
            <UserNav active="leaderboard" activeLeagueId={leagueId} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Leaderboard
          </h2>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Season standings and weekly rankings
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <LeaderboardTabs userId={session.user.id} />
        </div>
      </main>
    </div>
  );
}
