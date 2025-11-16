/**
 * API: /api/transactions - 取引一覧
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions, getUsers } from '@/lib/sheets';
import { TransactionView } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await getTransactions();
    const userRole = (session.user as any)?.role;

    // worker は自分の取引のみ、manager/admin は全取引
    let filteredTransactions = transactions;
    if (userRole === 'worker') {
      filteredTransactions = transactions.filter(tx => tx.workerId === (session.user as any).id);
    }

    // ユーザー情報を関連付け
    const transactionsView: TransactionView[] = filteredTransactions.map((tx) => {
      return {
        ...tx,
      } as TransactionView;
    });

    return NextResponse.json({
      success: true,
      data: transactionsView,
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
