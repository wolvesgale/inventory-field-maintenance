import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';
import { getTransactions } from '@/lib/sheets';
import { Transaction } from '@/types';

export async function GET(request: Request) {
  try {
    const sessionUser = getSessionUserFromRequest(new Request(request.url, { headers: request.headers } as RequestInit));
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const area = sessionUser.area;
    const transactions: Transaction[] = await getTransactions();
    const pending = transactions.filter((tx) => {
      const isPending = tx.status === 'pending' && tx.type === 'OUT';
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
