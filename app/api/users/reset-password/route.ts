import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUserFromRequest } from '@/auth';
import { getUserByLoginId, updateUserPassword } from '@/lib/sheets';

export async function POST(request: Request) {
  try {
    const sessionUser = getSessionUserFromRequest(new Request(request.url, { headers: request.headers } as RequestInit));

    if (!sessionUser || (sessionUser.role !== 'manager' && sessionUser.role !== 'admin')) {
      return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
    }

    const body = await request.json();
    const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : '';

    if (!loginId) {
      return NextResponse.json({ success: false, error: 'loginId は必須です' }, { status: 400 });
    }

    const user = await getUserByLoginId(loginId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    const hashed = await bcrypt.hash(loginId, 10);
    await updateUserPassword(loginId, hashed);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reset password:', error);
    return NextResponse.json({ success: false, error: 'パスワード初期化に失敗しました' }, { status: 500 });
  }
}
