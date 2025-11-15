/**
 * NextAuth.js 認証設定
 */

import { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByLoginId } from '@/lib/sheets';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.login_id = user.login_id;
        token.role = user.role;
        token.name = user.name;
        token.area = user.area;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.login_id = token.login_id as string;
        session.user.role = token.role as any;
        session.user.name = token.name as string;
        session.user.area = token.area as string;
      }
      return session;
    },
  },
  providers: [
    CredentialsProvider({
      credentials: {
        login_id: { label: 'ログインID', type: 'text' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login_id || !credentials?.password) {
          throw new Error('ログインIDとパスワードを入力してください');
        }

        try {
          const user = await getUserByLoginId(credentials.login_id as string);

          if (!user) {
            throw new Error('ログインIDが見つかりません');
          }

          if (!user.active) {
            throw new Error('このユーザーは無効化されています');
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          );

          if (!isValidPassword) {
            throw new Error('パスワードが正しくありません');
          }

          return {
            id: user.id,
            login_id: user.login_id,
            role: user.role,
            name: user.name,
            area: user.area,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : '認証に失敗しました';
          throw new Error(message);
        }
      },
    }),
  ],
};
