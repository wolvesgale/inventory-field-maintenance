/**
 * API: /api/items/search - 品目検索
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getItems } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyword =
      (request.nextUrl.searchParams.get('keyword') || request.nextUrl.searchParams.get('q') || '')
        .toLowerCase()
        .trim();
    const group =
      (request.nextUrl.searchParams.get('initial_group') || request.nextUrl.searchParams.get('group') || '')
        .toUpperCase()
        .trim();

    const items = await getItems();
    const filtered = items.filter((item) => {
      const matchesGroup = !group || group === 'ALL' || (item.initial_group || '').toUpperCase() === group;

      if (!matchesGroup) return false;

      if (!keyword) return true;

      return (
        item.item_code.toLowerCase().includes(keyword) ||
        item.item_name.toLowerCase().includes(keyword)
      );
    });

    return NextResponse.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error('Failed to search items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
