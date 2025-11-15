/**
 * NextAuth middleware - ルート保護と権限制御
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 権限マッピング
const roleRouteMap: Record<string, string[]> = {
  worker: ['/dashboard', '/transactions/new', '/transactions'],
  manager: [
    '/dashboard',
    '/transactions/new',
    '/transactions',
    '/approve',
    '/stock',
    '/physical-count',
    '/reports/monthly',
  ],
  admin: [
    '/dashboard',
    '/transactions/new',
    '/transactions',
    '/approve',
    '/stock',
    '/physical-count',
    '/reports/monthly',
  ],
};

// 認証が不要なルート
const publicRoutes = ['/login', '/api/auth'];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

function canAccessRoute(role: string, pathname: string): boolean {
  const allowedRoutes = roleRouteMap[role] || [];
  return allowedRoutes.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 公開ルートはスキップ
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // セッションを取得
  const session = await auth();

  // セッションがない場合 → ログインページへ
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ユーザーのロールに基づいてアクセス制御
  const userRole = session.user?.role || 'worker';
  if (!canAccessRoute(userRole, pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// middleware が適用されるパス
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
