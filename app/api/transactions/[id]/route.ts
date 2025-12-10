import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import {
  getTransactionById,
  updateTransaction,
} from '@/lib/sheets';
import { Transaction } from '@/types';

type TransactionType = Transaction['type'];

function normalizeType(value: unknown, qty?: number): TransactionType | undefined {
  const upper = typeof value === 'string' ? value.toUpperCase() : undefined;
  if (upper === 'IN' || upper === 'OUT') return upper;
  if (typeof qty === 'number' && Number.isFinite(qty) && qty !== 0) {
    return qty > 0 ? 'IN' : 'OUT';
  }
  return undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tx = await getTransactionById(params.id);
  if (!tx) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
  }

  if ((session.user as any)?.role === 'worker' && (session.user as any)?.id !== tx.user_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: tx });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await getTransactionById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    if ((session.user as any)?.role === 'worker' && (session.user as any)?.id !== existing.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const rawType = body.type ?? body.transactionType;
    const rawQty = body.qty ?? body.quantity;
    const rawReason = body.reason ?? body.memo;
    const rawDate = body.date ?? body.transactionDate;
    const rawItemCode = body.item_code ?? body.itemCode ?? existing.item_code;
    const rawItemName = body.item_name ?? body.itemName ?? existing.item_name;

    const parsedQty = rawQty !== undefined ? Number(rawQty) : existing.qty;
    const qty = Number.isFinite(parsedQty) ? Math.abs(parsedQty) : NaN;
    const normalizedType = normalizeType(rawType, parsedQty) ?? existing.type;
    const reason = rawReason !== undefined ? String(rawReason) : existing.reason ?? '';
    const date = rawDate !== undefined ? String(rawDate) : existing.date;
    const item_code = rawItemCode ? String(rawItemCode).trim() : '';
    const item_name = rawItemName ? String(rawItemName).trim() : '';

    if (!item_code) {
      return NextResponse.json({ success: false, error: 'item_code is required' }, { status: 400 });
    }
    if (!item_name) {
      return NextResponse.json({ success: false, error: 'item_name is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: 'qty must be a non-zero number' }, { status: 400 });
    }
    if (!normalizedType) {
      return NextResponse.json(
        { success: false, error: 'type is required (IN or OUT)' },
        { status: 400 },
      );
    }

    await updateTransaction(params.id, {
      item_code,
      item_name,
      qty,
      type: normalizedType,
      reason,
      date,
      status: existing.status || 'pending',
      approved_by: existing.approved_by,
      approved_at: existing.approved_at,
    });

    return NextResponse.json({ success: true, message: '取引を更新しました' });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update transaction' },
      { status: 500 },
    );
  }
}
