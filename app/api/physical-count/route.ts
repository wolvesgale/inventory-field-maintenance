// app/api/physical-count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions, addPhysicalCount, addDiffLog } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, location, counts } = body;

    if (!date || !location || !counts || !Array.isArray(counts)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // 在庫を集計して systemQuantity を計算
    const transactions = await getTransactions();
    const approvedTransactions = transactions.filter(
      (tx) => tx.status === 'approved' || tx.status === 'locked',
    );

    for (const count of counts) {
      const { item_code, actual_qty } = count;

      let systemQuantity = 0;
      approvedTransactions.forEach((tx) => {
        if (tx.item_code === item_code) {
          if (tx.type === 'IN') {
            systemQuantity += tx.qty;
          } else {
            systemQuantity -= tx.qty;
          }
        }
      });

      const actual = parseInt(String(actual_qty), 10);
      const difference = actual - systemQuantity;

      // PhysicalCount に記録
      const pcId = await addPhysicalCount({
        date,
        item_code,
        item_name: '',
        expected_qty: systemQuantity,
        actual_qty: actual,
        difference,
        user_id: user.id,
        user_name: user.name,
        location,
        status: 'draft',
      });

      // 差異がある場合、DiffLog に記録
      if (difference !== 0) {
        await addDiffLog({
          physical_count_id: pcId,
          item_code,
          item_name: '',
          expected_qty: systemQuantity,
          actual_qty: actual,
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
      { status: 500 },
    );
  }
}
