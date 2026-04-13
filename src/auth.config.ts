import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/signin",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
