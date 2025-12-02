import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions } from '@/lib/sheets';
import { Transaction } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const area = session.user.area;
    const transactions: Transaction[] = await getTransactions();
    const pending = transactions.filter((tx) => {
      const isPending = tx.status === 'pending';
      if (!isPending) return false;
      if (!area) return true;
      return tx.area === area;
    });

    return NextResponse.json({ success: true, data: pending });
  } catch (error) {
    console.error('Failed to load pending transactions:', error);
    return NextResponse.json({ success: false, error: 'Failed to load pending transactions' }, { status: 500 });
  }
}
