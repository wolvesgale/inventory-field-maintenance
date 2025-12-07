import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';
import { getTransactionById, updateTransaction } from '@/lib/sheets';
import { Transaction, TransactionType } from '@/types';

interface TransactionUpdateBody {
  date?: unknown;
  base?: unknown;
  location?: unknown;
  itemName?: unknown;
  itemCode?: unknown;
  quantity?: unknown;
  transactionType?: unknown;
  memo?: unknown;
}

const isTransactionType = (value: unknown): value is TransactionType => value === 'IN' || value === 'OUT';

const buildItemCode = (base: string, location: string): string => {
  const trimmedBase = base.trim();
  const trimmedLocation = location.trim();
  if (trimmedBase && trimmedLocation) {
    return `${trimmedBase} / ${trimmedLocation}`;
  }
  return trimmedBase || trimmedLocation || 'N/A';
};

const buildReason = (transactionType: TransactionType, base: string, location: string, memo?: string): string => {
  const labels: Record<TransactionType, string> = { IN: '入庫', OUT: '出庫' };
  const details = [`種別: ${labels[transactionType]}`, `拠点: ${base}`];
  if (location) {
    details.push(`棚: ${location}`);
  }
  if (memo) {
    details.push(`メモ: ${memo}`);
  }
  return details.join(' | ');
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const transaction = await getTransactionById(params.id);
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const isWorker = sessionUser.role === 'worker';
    if (isWorker && transaction.user_id !== sessionUser.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Failed to fetch transaction', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await getTransactionById(params.id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const isOwner = existing.user_id === sessionUser.id;
    if (!isOwner || existing.status === 'approved') {
      return NextResponse.json({ success: false, error: '編集権限がありません' }, { status: 403 });
    }

    const body = (await request.json()) as TransactionUpdateBody;

    if (!isTransactionType(body.transactionType)) {
      return NextResponse.json({ success: false, error: '取引種別が不正です' }, { status: 400 });
    }

    if (typeof body.date !== 'string' || typeof body.base !== 'string' || typeof body.itemName !== 'string') {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const quantityValue = Number(body.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue === 0) {
      return NextResponse.json({ success: false, error: '数量は0以外の数値を入力してください' }, { status: 400 });
    }

    const date = body.date.trim();
    const base = body.base.trim();
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const itemName = body.itemName.trim();
    const memo = typeof body.memo === 'string' ? body.memo.trim() : undefined;
    const itemCode = typeof body.itemCode === 'string' && body.itemCode.trim() ? body.itemCode.trim() : undefined;

    if (!date || !base || !itemName) {
      return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 });
    }

    const updates: Partial<Transaction> = {
      item_code: itemCode ?? buildItemCode(base, location),
      item_name: itemName,
      type: body.transactionType,
      qty: quantityValue,
      reason: buildReason(body.transactionType, base, location, memo),
      date,
    };

    await updateTransaction(params.id, updates);

    return NextResponse.json({ success: true, message: '取引を更新しました' });
  } catch (error) {
    console.error('Failed to update transaction', error);
    return NextResponse.json({ success: false, error: '取引の更新に失敗しました' }, { status: 500 });
  }
}
