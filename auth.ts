// auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByLoginId } from "@/lib/sheets";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        loginId: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials, req) {
        console.log("[authorize] called with:", credentials);

        if (!credentials?.loginId) {
          console.log("[authorize] no loginId");
          return null;
        }

        const user = {
          id: credentials.loginId,
          login_id: credentials.loginId,
          area: "DEBUG",
          name: "Debug User",
          email: null,
          image: null,
          role: "MANAGER",
        } as any;

        console.log("[authorize] returning user:", user);
        return user;
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
        (token as any).area = (user as any).area ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
        (session.user as any).area = (token as any).area;
      }
      return session;
    },
  },
};
