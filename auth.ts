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
        console.log('[DEBUG] authorize called with:', {
          loginId: credentials?.loginId,
          password: credentials?.password ? '***' : 'undefined',
        });

        if (!credentials?.loginId || !credentials?.password) {
          console.log('[DEBUG] Missing credentials');
          return null;
        }

        try {
          const user = await getUserByLoginId(credentials.loginId);
          console.log('[DEBUG] getUserByLoginId result:', user ? { ...user, password_hash: '***' } : null);

          if (!user) {
            console.log('[DEBUG] User not found or not active');
            return null;
          }

          if (!user.password_hash) {
            console.log('[DEBUG] User has no password_hash');
            return null;
          }

          const ok = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );
          console.log('[DEBUG] bcrypt.compare result:', ok);
          
          if (!ok) {
            console.log('[DEBUG] Password does not match');
            return null;
          }

          console.log('[DEBUG] Auth successful, returning user object');
          return {
            id: user.id,
            name: user.name || user.login_id,
            email: `${user.login_id}@dummy.local`,
            role: user.role,
            area: user.area,
          } as any;
        } catch (error) {
          console.error('[DEBUG] authorize error:', error);
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
