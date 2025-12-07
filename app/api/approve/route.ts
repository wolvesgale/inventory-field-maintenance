/**
 * API: /api/approve - 承認処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactionById, getTransactionsByStatus, updateTransactionStatus } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingTransactions = await getTransactionsByStatus('pending');
    const area = session.user.area;
    const filtered = pendingTransactions.filter((tx) => {
      if (tx.type !== 'OUT') return false;
      if (area && tx.area !== area) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      data: filtered,
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
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
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

    const current = await getTransactionById(transactionId);
    if (!current || current.type !== 'OUT' || (session.user.area && current.area !== session.user.area)) {
      return NextResponse.json({ success: false, error: '承認対象が見つかりません' }, { status: 404 });
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
