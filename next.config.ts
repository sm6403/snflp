import type { NextConfig } from "next";

// Expose the git commit SHA (set automatically by Vercel) as a public env var
// so both server and client components can read it at runtime.
// Falls back to "dev" in local development.
const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

export default nextConfig;
