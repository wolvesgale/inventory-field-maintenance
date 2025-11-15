/**
 * API: /api/physical-count - 棚卸
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTransactions, getItems, addPhysicalCount, addDiffLog } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'manager' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, location, counts } = body;

    if (!date || !location || !counts || !Array.isArray(counts)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 在庫を集計してexpected_qtyを計算
    const transactions = await getTransactions();
    const approvedTransactions = transactions.filter(tx => 
      tx.status === 'approved' || tx.status === 'locked'
    );

    // カウント保存 + DiffLog作成
    for (const count of counts) {
      const { item_code, actual_qty } = count;

      // expected_qty を計算
      let expected_qty = 0;
      approvedTransactions.forEach(tx => {
        if (tx.item_code === item_code) {
          if (tx.type === 'IN') {
            expected_qty += tx.qty;
          } else {
            expected_qty -= tx.qty;
          }
        }
      });

      // PhysicalCount に記録
      await addPhysicalCount({
        date,
        user_id: session.user.id,
        location,
        item_code,
        expected_qty,
        actual_qty: parseInt(actual_qty, 10),
      });

      // 差異がある場合、DiffLog に記録
      const diff = actual_qty - expected_qty;
      if (diff !== 0) {
        await addDiffLog({
          date,
          item_code,
          expected_qty,
          actual_qty: parseInt(actual_qty, 10),
          diff,
          reason: '',
          resolved_flag: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '棚卸結果を保存しました',
    });
  } catch (error) {
    console.error('Failed to save physical count:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save physical count' },
      { status: 500 }
    );
  }
}
