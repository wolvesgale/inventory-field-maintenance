/**
 * API: /api/items/search - 品目検索
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getItems } from '@/lib/sheets';
import {
  ItemGroupKey,
  PRIMARY_GROUP_KEYS,
  normalizeGroupParam,
  resolveGroupFromInitial,
} from '@/lib/itemGroups';

const matchesInitialGroup = (
  initial: string | undefined | null,
  selectedGroup: ItemGroupKey,
): boolean => {
  if (selectedGroup === 'ALL') return true;

  const value = (initial ?? '').trim().toUpperCase();

  if (selectedGroup === 'OTHER') {
    if (!value) return true;
    return !PRIMARY_GROUP_KEYS.some((key) => value.startsWith(key));
  }

  return value.startsWith(selectedGroup);
};

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
      .filter((item) => {
        if (!matchesInitialGroup(item.initial_group, selectedGroup)) {
          return false;
        }

        if (!keywordLower) return true;

        const codeLower = item.item_code.toLowerCase();
        const nameLower = item.item_name.toLowerCase();
        return codeLower.includes(keywordLower) || nameLower.includes(keywordLower);
      })
      .map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        group: resolveGroupFromInitial(item.initial_group),
      }));

    console.log('[items/search]', {
      received: { group: groupParam, keyword },
      total: items.length,
      filtered: candidates.length,
    });

    return NextResponse.json({
      success: true,
      items: candidates,
    });
  } catch (error) {
    console.error('Failed to search items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
