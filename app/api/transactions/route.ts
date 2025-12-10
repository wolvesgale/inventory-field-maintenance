/**
 * API: /api/transactions - 取引一覧
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';
import { getTransactions } from '@/lib/sheets';
import { Transaction, TransactionView } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await getTransactions();
    const userRole = sessionUser.role;

    // worker は自分の取引のみ、manager/admin は全取引
    let filteredTransactions: Transaction[] = transactions.filter(
      (tx) => !( (!tx.item_code || tx.item_code.trim() === '') && (!tx.qty || tx.qty === 0) )
    );
    if (userRole === 'worker') {
      filteredTransactions = filteredTransactions.filter(tx => tx.user_id === sessionUser.id);
    }

    // ユーザー情報を関連付け
    const transactionsView: TransactionView[] = filteredTransactions
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map((tx) => ({
        ...tx,
      } as TransactionView));

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
