/**
 * API: /api/transactions - 取引一覧
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions } from '@/lib/sheets';
import { TransactionView } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await getTransactions();
    const userRole = (session.user as any)?.role;
    const statusFilter = request.nextUrl.searchParams.get('status');

    // 状態フィルタ（pending など）
    let filteredTransactions = transactions;
    if (statusFilter) {
      filteredTransactions = filteredTransactions.filter(
        (tx) => tx.status === statusFilter,
      );
    }

    // worker は基本自分の取引のみ、ただし pending 一覧は全件確認できるようにする
    if (userRole === 'worker' && statusFilter !== 'pending') {
      const userId = (session.user as any).id;
      const userName = (session.user as any).name;
      filteredTransactions = filteredTransactions.filter((tx) => {
        const idMatch = tx.user_id && userId && tx.user_id === userId;
        const nameMatch = tx.user_name && userName && tx.user_name === userName;
        return idMatch || nameMatch;
      });
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
