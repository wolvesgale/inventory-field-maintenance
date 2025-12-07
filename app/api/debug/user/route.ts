import { NextRequest, NextResponse } from 'next/server';
import { getUserByLoginId } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const login_id = String(request.nextUrl.searchParams.get('login_id') || '');
    if (!login_id) {
      return NextResponse.json({ success: false, error: 'login_id is required' }, { status: 400 });
    }

    const user = await getUserByLoginId(login_id);
    if (!user) {
      return NextResponse.json({ success: false, data: null });
    }

    // パスワードハッシュはマスクして返す
    const safe = { ...user, password_hash: user.password_hash ? '***' : undefined };
    return NextResponse.json({ success: true, data: safe });
  } catch (err) {
    console.error('debug/user error', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
