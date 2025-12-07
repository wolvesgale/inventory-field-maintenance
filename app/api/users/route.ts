import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getUsers } from '@/lib/sheets';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const users = await getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
