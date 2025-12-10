/**
 * API: /api/physical-count - 棚卸
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';
import { getTransactions, getItems, addPhysicalCount, addDiffLog } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = getSessionUserFromRequest(request);
    if (!sessionUser || (sessionUser.role !== 'manager' && sessionUser.role !== 'admin')) {
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

    // 在庫を集計してsystemQuantityを計算
    const transactions = await getTransactions();
    const approvedTransactions = transactions.filter(tx => 
      tx.status === 'approved' || tx.status === 'locked'
    );

    // カウント保存 + DiffLog作成
    for (const count of counts) {
      const { item_code, actual_qty } = count;

      // systemQuantity を計算
      let systemQuantity = 0;
      approvedTransactions.forEach(tx => {
        if (tx.item_code === item_code) {
          if (tx.type === 'IN') {
            systemQuantity += tx.qty;
          } else {
            systemQuantity -= tx.qty;
          }
        }
      });

      // PhysicalCount に記録
      const pcId = await addPhysicalCount({
        date,
        item_code,
        item_name: '',
        expected_qty: systemQuantity,
        actual_qty: parseInt(String(actual_qty), 10),
        difference: parseInt(String(actual_qty), 10) - systemQuantity,
        user_id: (session.user as any).id,
        user_name: (session.user as any).name,
        location,
        status: 'draft',
      });

      // 差異がある場合、DiffLog に記録
      const difference = parseInt(String(actual_qty), 10) - systemQuantity;
      if (difference !== 0) {
        await addDiffLog({
          physical_count_id: pcId,
          item_code,
          item_name: '',
          expected_qty: systemQuantity,
          actual_qty: parseInt(String(actual_qty), 10),
          diff: difference,
          reason: '',
          status: 'pending',
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
