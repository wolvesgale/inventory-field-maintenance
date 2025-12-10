/**
 * API: /api/stock - 在庫集計
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getStockAggregate } from '@/lib/sheets';

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

    const stockListRaw = await getStockAggregate();
    let stockList = [...stockListRaw];

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
            initial_group: undefined,
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
