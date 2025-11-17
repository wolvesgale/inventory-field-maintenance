// auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByLoginId } from "@/lib/sheets";

type AuthenticatedUser = {
  id: string;
  loginId: string;
  login_id: string;
  name?: string | null;
  role?: string;
  area?: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        loginId: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.loginId || !credentials?.password) {
          throw new Error("ログインIDとパスワードを入力してください。");
        }

        const loginId = credentials.loginId.trim();
        const user = await getUserByLoginId(loginId);

        if (!user || user.active !== true) {
          throw new Error("ログインIDまたはパスワードが違います。");
        }

        const ok = await bcrypt.compare(credentials.password, user.password_hash);

        if (!ok) {
          throw new Error("ログインIDまたはパスワードが違います。");
        }

        const authenticatedUser: AuthenticatedUser = {
          id: String(user.id),
          loginId: user.login_id,
          login_id: user.login_id,
          name: user.name,
          role: user.role,
          area: user.area,
        };

        return authenticatedUser;
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
        const authUser = user as AuthenticatedUser;
        token.loginId = authUser.loginId;
        token.role = authUser.role;
        token.area = authUser.area;
        token.name = authUser.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const userExtensions: Record<string, unknown> = session.user;
        userExtensions.loginId = token.loginId;
        userExtensions.role = token.role;
        userExtensions.area = token.area;
        session.user.name = (token.name as string | null | undefined) ?? session.user.name;
      }
      return session;
    },
  },
};
