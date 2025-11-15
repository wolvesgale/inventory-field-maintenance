/**
 * API: /api/approve - 承認処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTransactionsByStatus, updateTransactionStatus } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'manager' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingTransactions = await getTransactionsByStatus('pending');

    return NextResponse.json({
      success: true,
      data: pendingTransactions,
    });
  } catch (error) {
    console.error('Failed to fetch pending transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'manager' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, action, comment } = body;

    if (!transactionId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      const now = new Date().toISOString();
      await updateTransactionStatus(
        transactionId,
        'approved',
        session.user.id,
        now.split('T')[0]
      );
    } else if (action === 'reject') {
      await updateTransactionStatus(transactionId, 'draft');
    }

    return NextResponse.json({
      success: true,
      message: `取引を${action === 'approve' ? '承認' : '差し戻し'}しました`,
    });
  } catch (error) {
    console.error('Failed to approve transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve transaction' },
      { status: 500 }
    );
  }
}
