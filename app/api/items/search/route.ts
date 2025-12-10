/**
 * API: /api/items/search - 品目検索
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getItems } from '@/lib/sheets';
import { detectItemGroup, normalizeGroupParam } from '@/lib/itemGroups';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupParam = request.nextUrl.searchParams.get('group');
    const keyword = request.nextUrl.searchParams.get('q') || '';

    const selectedGroup = normalizeGroupParam(groupParam);
    const keywordLower = keyword.trim().toLowerCase();

    const items = await getItems();

    const candidates = items
      .map((item) => {
        const initial_group = detectItemGroup(item.item_name, item.item_code, item.category);
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          initial_group,
        };
      })
      .filter((item) => {
        const matchesKeyword =
          !keywordLower ||
          item.item_name.toLowerCase().includes(keywordLower) ||
          item.item_code.toLowerCase().includes(keywordLower);

        const matchesGroup =
          selectedGroup === 'すべて' ||
          (selectedGroup === 'その他' && item.initial_group === 'その他') ||
          item.initial_group === selectedGroup;

        return matchesKeyword && matchesGroup;
      });

    return NextResponse.json({
      success: true,
      data: candidates,
    });
  } catch (error) {
    console.error('Failed to search items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
