import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { FavoriteTeamPicker } from "@/components/favorite-team-picker";
import { AliasEditor } from "@/components/alias-editor";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteTeam: true, alias: true },
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Welcome{session.user.name ? `, ${session.user.name}` : ""}!
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are signed in. This is your protected dashboard.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Weekly Picks
          </h3>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-zinc-600 dark:text-zinc-300">
              Make your picks for this week&apos;s NFL games.
            </p>
            <Link
              href="/picks"
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Go to Picks
            </Link>
          </div>
        </div>

        <AliasEditor initialAlias={user?.alias ?? ""} />
        <FavoriteTeamPicker initialTeam={user?.favoriteTeam ?? "Los Angeles Rams"} />
      </main>
    </div>
  );
}
