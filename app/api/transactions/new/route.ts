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
    const { type, date, item_code, item_name, qty, slip_photo_url, isNewItem } = body;

    // バリデーション
    if (!type || !date || !item_code || !qty) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    // 新規品目の場合、Items に追加
    if (isNewItem) {
      if (!item_name) {
        return NextResponse.json(
          { success: false, error: 'Item name is required for new items' },
          { status: 400 }
        );
      }

      const existingItem = await getItemByCode(item_code);
      if (!existingItem) {
        await addItem({
          item_code,
          item_name,
          category: '',
          unit: '個',
          created_at: new Date().toISOString().split('T')[0],
          new_flag: true,
        });
      }
    }

    // 入出庫取引を追加
    const transaction: Omit<Transaction, 'id'> = {
      date,
      user_id: session.user.id,
      area: session.user.area,
      type: type as any,
      item_code,
      qty: parsedQty,
      slip_photo_url: slip_photo_url || undefined,
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
