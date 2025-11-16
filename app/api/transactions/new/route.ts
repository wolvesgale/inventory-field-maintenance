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
    const { type, timestamp, itemCode, itemName, quantity, reason, isNewItem } = body;

    // バリデーション
    if (!type || !timestamp || !itemCode || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(String(quantity), 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    // 新規品目の場合、Items に追加
    if (isNewItem) {
      if (!itemName) {
        return NextResponse.json(
          { success: false, error: 'Item name is required for new items' },
          { status: 400 }
        );
      }

      const existingItem = await getItemByCode(itemCode);
      if (!existingItem) {
        await addItem({
          code: itemCode,
          name: itemName,
          category: '',
          unit: '個',
          standardQuantity: 0,
          minQuantity: 0,
          location: '',
        });
      }
    }

    // 入出庫取引を追加
    const transaction: Omit<Transaction, 'id'> = {
      itemId: '', // 別途設定が必要
      itemCode,
      itemName: itemName || '',
      type: type as 'add' | 'remove' | 'adjustment',
      quantity: parsedQty,
      reason: reason || '',
      workerId: (session.user as any).id,
      workerName: (session.user as any).name,
      area: (session.user as any).area || '',
      timestamp,
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
