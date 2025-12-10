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
} from '@/lib/itemGroups';

const MAIN_GROUPS = PRIMARY_GROUP_KEYS;

const normalizeInitialGroup = (value?: string | null): string | null => {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized || null;
};

const resolveGroupFromInitial = (initial: string | undefined | null): ItemGroupKey => {
  const value = normalizeInitialGroup(initial);
  if (!value) return 'OTHER';

  const matched = MAIN_GROUPS.find((group) => value.startsWith(group));
  return matched ?? 'OTHER';
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

    let filtered = items;

    if (selectedGroup !== 'ALL') {
      if (selectedGroup === 'OTHER') {
        filtered = filtered.filter((item) => {
          const group = normalizeInitialGroup(item.initial_group);
          if (!group) return true;
          return !MAIN_GROUPS.some((main) => group.startsWith(main));
        });
      } else {
        filtered = filtered.filter((item) => {
          const group = normalizeInitialGroup(item.initial_group);
          if (!group) return false;
          return group.startsWith(selectedGroup);
        });
      }
    }

    if (keywordLower) {
      filtered = filtered.filter((item) => {
        const codeLower = (item.item_code || '').toLowerCase();
        const nameLower = (item.item_name || '').toLowerCase();
        return codeLower.includes(keywordLower) || nameLower.includes(keywordLower);
      });
    }

    const candidates = filtered.map((item) => ({
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
