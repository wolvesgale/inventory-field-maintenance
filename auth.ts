// auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByLoginId } from "@/lib/sheets";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Inventory Login",
      credentials: {
        loginId: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        console.log("authorize: raw credentials =", credentials);

        if (!credentials) {
          console.log("authorize: no credentials");
          return null;
        }

        const loginId = credentials.loginId?.trim();
        const password = credentials.password ?? "";

        console.log("authorize: loginId =", loginId);

        if (!loginId || !password) {
          console.log("authorize: missing loginId or password");
          return null;
        }

        const trimmedLoginId = credentials.loginId.trim();

        try {
          const user = await getUserByLoginId(loginId);
          console.log("authorize: loaded user from sheet =", user);

          if (!user) {
            console.log("authorize: user not found");
            return null;
          }

          if (user.active === false || String(user.active).toUpperCase() === "FALSE") {
            console.log("authorize: user is not active");
            return null;
          }

          // const ok = await bcrypt.compare(password, user.password_hash);
          // if (!ok) {
          //   console.log("authorize: password mismatch");
          //   return null;
          // }

          return {
            id: String(user.id ?? user.login_id),
            name: user.name ?? user.login_id,
            email: `${user.login_id}@example.com`,
            role: user.role,
            area: user.area,
          } as any;
        } catch (error) {
          console.error("authorize: unexpected error", error);
          return null;
        }
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
