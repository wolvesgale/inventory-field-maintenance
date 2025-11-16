/**
 * API: /api/physical-count - 棚卸
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions, getItems, addPhysicalCount, addDiffLog } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { countDate, location, counts } = body;

    if (!countDate || !location || !counts || !Array.isArray(counts)) {
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
      const { itemCode, countedQuantity } = count;

      // systemQuantity を計算
      let systemQuantity = 0;
      approvedTransactions.forEach(tx => {
        if (tx.itemCode === itemCode) {
          if (tx.type === 'add') {
            systemQuantity += tx.quantity;
          } else {
            systemQuantity -= tx.quantity;
          }
        }
      });

      // PhysicalCount に記録
      await addPhysicalCount({
        countDate,
        itemId: '', // 別途設定が必要
        itemCode,
        itemName: '',
        countedQuantity: parseInt(String(countedQuantity), 10),
        systemQuantity,
        difference: parseInt(String(countedQuantity), 10) - systemQuantity,
        workerId: (session.user as any).id,
        workerName: (session.user as any).name,
        area: (session.user as any).area || '',
        status: 'draft',
      });

      // 差異がある場合、DiffLog に記録
      const difference = parseInt(String(countedQuantity), 10) - systemQuantity;
      if (difference !== 0) {
        await addDiffLog({
          physicalCountId: '', // addPhysicalCount の戻り値を使用すること
          itemId: '',
          itemCode,
          itemName: '',
          difference,
          reportedDate: countDate,
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
