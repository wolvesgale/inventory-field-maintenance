/**
 * API: POST /api/import/initial-stock
 * メーカー報告書 CSV（入力在庫数,品目コード,品目名称）から StockLedger を初期化する。
 * 月次運用開始時の一回限りの初期投入に使用。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { initializeStockLedger } from '@/lib/sheets';

/**
 * CSV テキストをパースして品目リストに変換する。
 * 期待する列順: 入力在庫数, 品目コード, 品目名称
 * 先頭行がヘッダーの場合はスキップ。
 */
function parseStockCSV(
  csvText: string,
): Array<{ item_code: string; item_name: string; qty: number }> {
  const lines = csvText.trim().split(/\r?\n/);
  const result: Array<{ item_code: string; item_name: string; qty: number }> = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // 簡易 CSV パース（ダブルクォート対応）
    const cols = line
      .split(',')
      .map((c) => c.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));

    // ヘッダー行をスキップ（先頭が数値でない場合）
    const qty = Number(cols[0]);
    if (!Number.isFinite(qty)) continue;

    const item_code = cols[1] || '';
    const item_name = cols[2] || '';
    if (!item_code) continue;

    result.push({ item_code, item_name, qty });
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    let items: Array<{ item_code: string; item_name: string; qty: number }>;

    if (typeof body.csvText === 'string') {
      items = parseStockCSV(body.csvText);
    } else if (Array.isArray(body.items)) {
      items = body.items;
    } else {
      return NextResponse.json(
        { success: false, error: 'csvText または items が必要です' },
        { status: 400 },
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'インポートするデータが見つかりませんでした。CSV の形式を確認してください。' },
        { status: 400 },
      );
    }

    const result = await initializeStockLedger(items);

    return NextResponse.json({
      success: true,
      message: `在庫データをインポートしました（更新: ${result.updated} 件、新規追加: ${result.appended} 件）`,
      ...result,
    });
  } catch (error) {
    console.error('Failed to import initial stock:', error);
    return NextResponse.json(
      { success: false, error: 'インポートに失敗しました' },
      { status: 500 },
    );
  }
}
