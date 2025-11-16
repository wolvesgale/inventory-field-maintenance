/**
 * API: /api/stock - 在庫集計
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions, getItems } from '@/lib/sheets';
import { StockViewItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await getTransactions();
    const items = await getItems();

    // 承認済み以上の取引を抽出
    const approvedTransactions = transactions.filter(tx => 
      tx.status === 'approved' || tx.status === 'locked'
    );

    // 品目ごとに集計
    const stockMap = new Map<string, StockViewItem>();

    items.forEach(item => {
      stockMap.set(item.code, {
        item_code: item.code,
        item_name: item.name,
        opening_qty: 0,
        in_qty: 0,
        out_qty: 0,
        closing_qty: 0,
        new_flag: false,
        is_new: false,
      });
    });

    // 取引から集計
    approvedTransactions.forEach(tx => {
      const key = tx.itemCode;
      if (!stockMap.has(key)) {
        const item = items.find(i => i.code === tx.itemCode);
        stockMap.set(key, {
          item_code: tx.itemCode,
          item_name: item?.name || '不明',
          opening_qty: 0,
          in_qty: 0,
          out_qty: 0,
          closing_qty: 0,
          new_flag: false,
          is_new: false,
        });
      }

      const stock = stockMap.get(key)!;
      if (tx.type === 'add') {
        stock.in_qty += tx.quantity;
      } else if (tx.type === 'remove') {
        stock.out_qty += tx.quantity;
      }
      stock.closing_qty = stock.opening_qty + stock.in_qty - stock.out_qty;
    });

    const stockList = Array.from(stockMap.values());

    return NextResponse.json({
      success: true,
      data: stockList,
    });
  } catch (error) {
    console.error('Failed to fetch stock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}
