import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 text-center px-6">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          SNFLP
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Welcome to your app. Sign in to access your dashboard.
        </p>
        <div className="flex gap-4">
          <Link
            href="/signin"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Sign Up
          </Link>
        </div>
      </main>
    </div>
  );
}
