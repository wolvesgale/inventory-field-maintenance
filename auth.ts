/**
 * NextAuth.js メイン設定
 */

import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth, signIn, signOut, handlers } = NextAuth(authConfig);
