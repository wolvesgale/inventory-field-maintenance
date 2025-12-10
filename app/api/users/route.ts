import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';
import { getUsers } from '@/lib/sheets';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionUserFromRequest(new Request(request.url, { headers: request.headers } as RequestInit));
    if (!sessionUser || (sessionUser.role !== 'manager' && sessionUser.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const users = await getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
