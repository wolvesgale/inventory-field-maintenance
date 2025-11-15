import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth v4 設定
 * まずはデモユーザーだけで動かし、
 * 後で Google Sheets 連携に差し替える前提の最小構成。
 */

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Inventory Login",
      credentials: {
        loginId: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.loginId || !credentials?.password) {
          return null;
        }

        // TODO: 後で Sheets 連携に差し替える。
        // ひとまず「demo / demo」でログインできるデモユーザーを用意。
        if (
          credentials.loginId === "demo" &&
          credentials.password === "demo"
        ) {
          return {
            id: "1",
            name: "デモ管理者",
            email: "demo@example.com",
            role: "manager",
          } as any;
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any).role ?? "worker";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
};
