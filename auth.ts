// auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByLoginId } from "@/lib/sheets";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Inventory Login",
      credentials: {
        login_id: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        console.log("[DEBUG] authorize called with:", {
          login_id: credentials?.login_id,
          password: credentials?.password ? "***" : "undefined",
        });

        if (!credentials?.login_id || !credentials?.password) {
          console.log("[DEBUG] Missing credentials");
          throw new Error("ログインIDとパスワードを入力してください");
        }

        const loginId = credentials.login_id.trim();
        const password = credentials.password;

        const user = await getUserByLoginId(loginId);
        console.log("[DEBUG] getUserByLoginId result:", user ? { ...user, password_hash: "***" } : null);

        // ユーザーがいない or active ではない
        if (!user) {
          console.log("[DEBUG] User not found or not active");
          throw new Error("ログインIDまたはパスワードが違います");
        }

        // ★ ここが重要：Sheets の password_hash 列を「平文パスワード」としてそのまま比較
        if (!user.password_hash) {
          console.log("[DEBUG] User has no password_hash");
          throw new Error("ログインIDまたはパスワードが違います");
        }

        if (user.password_hash !== password) {
          console.log("[DEBUG] Password does not match");
          throw new Error("ログインIDまたはパスワードが違います");
        }

        console.log("[DEBUG] Auth successful, returning user object");
        return {
          id: user.id,
          login_id: user.login_id,
          name: user.name || user.login_id,
          email: `${user.login_id}@dummy.local`,
          role: user.role,
          area: user.area ?? "",
        } as any;
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
