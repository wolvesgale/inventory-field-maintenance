/**
 * API: /api/items/search - 品目検索
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { getItems } from '@/lib/sheets';
import {
  detectItemGroup,
  matchesGroupPrefix,
  normalizeGroupParam,
} from '@/lib/itemGroups';

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
        const group = detectItemGroup(item.item_name, item.item_code);
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          group,
        };
      })
      .filter((item) => {
        const detectedGroup = item.group;

        const matchesGroup =
          selectedGroup === 'ALL'
            ? true
            : selectedGroup === 'OTHER'
            ? detectedGroup === 'OTHER'
            : detectedGroup === selectedGroup ||
              matchesGroupPrefix(item.item_code, selectedGroup) ||
              matchesGroupPrefix(item.item_name, selectedGroup);

        if (!matchesGroup) return false;

        if (!keywordLower) return true;

        const codeLower = item.item_code.toLowerCase();
        const nameLower = item.item_name.toLowerCase();
        return codeLower.includes(keywordLower) || nameLower.includes(keywordLower);
      });

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
