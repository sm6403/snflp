import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserNav } from "@/components/user-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { UserSettingsContent } from "@/components/user-settings-content";
import { resolveUserLeagueId } from "@/lib/league-context";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const [user, leagueId] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { alias: true, email: true, name: true, emailReminders: true },
    }),
    resolveUserLeagueId(session.user.id),
  ]);

  if (!user) redirect("/signin");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <UserNav active="settings" activeLeagueId={leagueId} />
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-bold text-zinc-50">Account Settings</h1>
        <p className="mb-8 text-sm text-zinc-500">Manage your display name, email, and password.</p>

        <UserSettingsContent
          initialAlias={user.alias ?? user.name ?? ""}
          initialEmail={user.email}
          initialEmailReminders={user.emailReminders}
        />
      </main>
    </div>
  );
}
