// auth.ts
import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByLoginId } from "@/lib/sheets";

type UserRole = "worker" | "manager";

type AuthenticatedUser = User;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        loginId: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.loginId || !credentials?.password) {
          throw new Error("ログインIDとパスワードを入力してください。");
        }

        const loginId = credentials.loginId.trim();
        const user = await getUserByLoginId(loginId);

        if (!user || user.active !== true) {
          throw new Error("ログインIDまたはパスワードが違います。");
        }

        if (!user.password_hash) {
          console.error(`No password_hash for login_id: ${loginId}`);
          throw new Error(
            "パスワードが未設定です。管理者に問い合わせてください。"
          );
        }

        const ok = await bcrypt.compare(credentials.password, user.password_hash);

        if (!ok) {
          throw new Error("ログインIDまたはパスワードが違います。");
        }

        const rawRole = (user.role ?? "").trim().toLowerCase();
        const role: UserRole = rawRole === "manager" ? "manager" : "worker";

        const authenticatedUser: User = {
          id: String(user.id),
          name: user.name || "",
          login_id: user.login_id,
          role,
          area: user.area ?? undefined,
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
        token.login_id = authUser.login_id;
        token.role = authUser.role;
        token.area = authUser.area;
        token.name = authUser.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string | undefined) ?? session.user.id;
        session.user.name =
          (token.name as string | undefined) ?? session.user.name;
        session.user.login_id =
          (token.login_id as string | undefined) ?? session.user.login_id;
        session.user.role = (token.role as UserRole | undefined) ?? session.user.role;
        session.user.area = (token.area as string | undefined) ?? session.user.area;
      }
      return session;
    },
  },
};
