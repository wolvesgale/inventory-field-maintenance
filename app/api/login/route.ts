import { NextResponse } from 'next/server';
import { authenticate, setSessionCookie } from '@/auth';

export async function POST(request: Request) {
  try {
    const { loginId, password } = await request.json();
    if (!loginId || !password) {
      return NextResponse.json({ error: 'ログインIDとパスワードを入力してください' }, { status: 400 });
    }

    const user = await authenticate(loginId, password);
    if (!user) {
      return NextResponse.json({ error: 'ログインに失敗しました' }, { status: 401 });
    }

    const res = NextResponse.json({ user });
    setSessionCookie(res, user);
    return res;
  } catch (error) {
    console.error('Login failed', error);
    return NextResponse.json({ error: 'ログイン処理でエラーが発生しました' }, { status: 500 });
  }
}
