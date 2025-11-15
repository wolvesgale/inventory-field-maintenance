/**
 * API: /api/items/search - 品目検索
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchItems } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    const items = await searchItems(query);

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Failed to search items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
