/**
 * API: /api/approve - 承認処理
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactionsByStatus, updateTransactionStatus } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
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

    const actorName = (session.user as any)?.name || session.user.id;
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

    if (action === 'approve') {
      const { stockLedgerUpdated } = await updateTransactionStatus(
        transactionId, 'approved', { actorName }
      );
      if (!stockLedgerUpdated) {
        // トランザクションはシート上で承認済み。在庫台帳のみ更新失敗。
        return NextResponse.json({
          success: true,
          warning: 'stockLedgerSyncFailed',
          message: '承認しました（在庫台帳の更新に失敗しました。管理者に連絡してください）',
        });
      }
    } else if (action === 'reject') {
      if (!trimmedComment) {
        return NextResponse.json(
          { success: false, error: '差し戻しコメントを入力してください' },
          { status: 400 }
        );
      }
      await updateTransactionStatus(transactionId, 'returned', {
        actorName,
        returnComment: trimmedComment,
      });
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
