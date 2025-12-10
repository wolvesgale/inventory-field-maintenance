// app/api/transactions/new/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { addTransaction, addItem, getItemByCode } from '@/lib/sheets';
import { Transaction } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const rawType = body.type ?? body.transactionType;
    const rawItemCode = body.item_code ?? body.itemCode;
    const rawItemName = body.item_name ?? body.itemName;
    const rawQty = body.qty ?? body.quantity;
    const rawReason = body.reason ?? body.memo;
    const isNewItem = Boolean(body.is_new_item);

    const date = body.date ? String(body.date) : '';
    const item_code = rawItemCode ? String(rawItemCode).trim() : '';
    const item_name = rawItemName ? String(rawItemName).trim() : '';

    const parsedQty = Number(rawQty);
    const qty = Number.isFinite(parsedQty) ? Math.abs(parsedQty) : NaN;
    const normalizedType = (() => {
      const upper = rawType ? String(rawType).toUpperCase() : undefined;
      if (upper === 'IN' || upper === 'OUT') return upper;
      if (Number.isFinite(parsedQty) && parsedQty !== 0) {
        return parsedQty > 0 ? 'IN' : 'OUT';
      }
      return undefined;
    })();
    const reason = rawReason ? String(rawReason) : '';

    // バリデーション
    if (!date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }
    if (!item_code) {
      return NextResponse.json(
        { success: false, error: 'item_code is required' },
        { status: 400 },
      );
    }
    if (!item_name) {
      return NextResponse.json(
        { success: false, error: 'item_name is required' },
        { status: 400 },
      );
    }
    if (!normalizedType) {
      return NextResponse.json(
        { success: false, error: 'type is required (IN or OUT)' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: 'qty must be a non-zero number' },
        { status: 400 },
      );
    }

    // 新規品目の場合、Items に追加
    if (isNewItem) {
      if (!item_name) {
        return NextResponse.json(
          { success: false, error: 'Item name is required for new items' },
          { status: 400 },
        );
      }

      const existingItem = await getItemByCode(item_code);
      if (!existingItem) {
        await addItem({
          item_code,
          item_name,
          category: '',
          unit: '個',
          created_at: new Date().toISOString(),
          new_flag: true,
        });
      }
    }

    // 入出庫取引を追加
    const transaction: Omit<Transaction, 'id'> = {
      item_code,
      item_name,
      type: normalizedType,
      qty,
      reason,
      user_id: (session.user as any).id,
      user_name: (session.user as any).name,
      area: (session.user as any).area || '',
      date,
      status: 'pending',
    };

    await addTransaction(transaction);

    return NextResponse.json({
      success: true,
      message: '取引を登録しました',
    });
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 },
    );
  }
}
