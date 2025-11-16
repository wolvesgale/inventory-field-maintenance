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
    const {
      type,
      date,
      item_code,
      item_name,
      qty,
      reason,
      is_new_item,
      isNewItem,
    } = body;

    const normalizeBoolean = (value: unknown): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const lowered = value.toLowerCase();
        return lowered === 'true' || lowered === '1';
      }
      return false;
    };

    const isNewItemFlag = normalizeBoolean(
      typeof is_new_item !== 'undefined' ? is_new_item : isNewItem
    );

    // バリデーション
    if (!type || !date || !item_code || (qty === undefined || qty === null)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(String(qty), 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    // 新規品目の場合、Items に追加
    if (isNewItemFlag) {
      if (!item_name) {
        return NextResponse.json(
          { success: false, error: 'Item name is required for new items' },
          { status: 400 }
        );
      }

      const existingItem = await getItemByCode(item_code);
      if (!existingItem) {
        await addItem({
          item_code: item_code,
          item_name: item_name,
          category: '',
          unit: '個',
          created_at: new Date().toISOString(),
          new_flag: true,
        });
      }
    }

    // 入出庫取引を追加
    const transaction: Omit<Transaction, 'id'> = {
      item_code: item_code,
      item_name: item_name || '',
      type: type as 'IN' | 'OUT',
      qty: parsedQty,
      reason: reason || '',
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
      { status: 500 }
    );
  }
}
