/**
 * API: /api/stock - 在庫集計
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getTransactions, getItems } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const itemCode = request.nextUrl.searchParams.get('itemCode')?.trim();
    if (
      !session ||
      ((session.user as any)?.role !== 'manager' &&
        (session.user as any)?.role !== 'admin' &&
        (session.user as any)?.role !== 'worker')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await getTransactions();
    const items = await getItems();

    // 承認済み以上の取引を抽出
    const approvedTransactions = transactions.filter(tx => 
      tx.status === 'approved' || tx.status === 'locked'
    );

    // 品目ごとに集計
    const stockMap = new Map<
      string,
      {
        item_code: string;
        item_name: string;
        opening_qty: number;
        in_qty: number;
        out_qty: number;
        closing_qty: number;
        new_flag: boolean;
        is_new: boolean;
      }
    >();

    items.forEach(item => {
      stockMap.set(item.item_code, {
        item_code: item.item_code,
        item_name: item.item_name,
        opening_qty: 0,
        in_qty: 0,
        out_qty: 0,
        closing_qty: 0,
        new_flag: !!item.new_flag,
        is_new: !!item.new_flag,
      });
    });

    // 取引から集計
    approvedTransactions.forEach(tx => {
      const key = tx.item_code;
      if (!stockMap.has(key)) {
        const item = items.find(i => i.item_code === tx.item_code);
        stockMap.set(key, {
          item_code: tx.item_code,
          item_name: item?.item_name || '不明',
          opening_qty: 0,
          in_qty: 0,
          out_qty: 0,
          closing_qty: 0,
          new_flag: false,
          is_new: !!item?.new_flag,
        });
      }

      const stock = stockMap.get(key)!;
      if (tx.type === 'IN') {
        stock.in_qty += tx.qty;
      } else if (tx.type === 'OUT') {
        stock.out_qty += tx.qty;
      }
      stock.closing_qty = stock.opening_qty + stock.in_qty - stock.out_qty;
    });

    let stockList = Array.from(stockMap.values());

    if (itemCode) {
      stockList = stockList.filter(
        (entry) => entry.item_code && entry.item_code === itemCode,
      );

      if (stockList.length === 0) {
        stockList = [
          {
            item_code: itemCode,
            item_name: '',
            opening_qty: 0,
            in_qty: 0,
            out_qty: 0,
            closing_qty: 0,
            new_flag: false,
            is_new: false,
          },
        ];
      }
    }

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
