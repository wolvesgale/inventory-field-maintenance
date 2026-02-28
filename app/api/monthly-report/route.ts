/**
 * API: /api/monthly-report - 月次レポート
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import {
  getTransactions,
  getItems,
  getDiffLogs,
  getPhysicalCounts,
  addSupplierReport,
  updateTransactionStatus,
  getSupplierReportsByMonth,
  updateStockLedgerForMonthEnd,
  getStockAggregate,
} from '@/lib/sheets';
import { MonthlyReportItem } from '@/types';

/**
 * GET /api/monthly-report
 * 現在の在庫数をメーカー報告書フォーマット（入力在庫数,品目コード,品目名称）でCSV出力
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stockList = await getStockAggregate();

    // メーカー報告書と同じ列順: 入力在庫数, 品目コード, 品目名称
    const csvRows = [
      ['入力在庫数', '品目コード', '品目名称'],
      ...stockList.map(item => [
        String(item.closing_qty),
        item.item_code,
        item.item_name,
      ]),
    ];

    const csv = csvRows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const today = new Date().toISOString().slice(0, 10);
    return new Response('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stock_report_${today}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate stock CSV:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate stock CSV' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any)?.role !== 'manager' && (session.user as any)?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { month, action } = body;

    if (!month) {
      return NextResponse.json(
        { success: false, error: 'Month is required' },
        { status: 400 }
      );
    }

    const transactions = await getTransactions();
    const items = await getItems();
    const diffs = await getDiffLogs();

    // 対象月のデータを抽出
    const monthTransactions = transactions.filter(tx => 
      tx.date.startsWith(month) && (tx.status === 'approved' || tx.status === 'locked')
    );

    // 品目ごとに集計
    const reportMap = new Map<string, MonthlyReportItem>();

    monthTransactions.forEach(tx => {
      const key = tx.item_code;
      if (!reportMap.has(key)) {
        const item = items.find(i => i.item_code === tx.item_code);
        reportMap.set(key, {
          item_code: tx.item_code,
          item_name: item?.item_name || '不明',
          expected_qty: 0,
          actual_qty: 0,
          diff: 0,
          has_diff: false,
          is_new_item: !!item?.new_flag,
        });
      }

      const report = reportMap.get(key)!;
      if (tx.type === 'IN') {
        report.expected_qty += tx.qty;
      } else if (tx.type === 'OUT') {
        report.expected_qty -= tx.qty;
      }
    });

    // DiffLog から差異情報を関連付け
    diffs.forEach(diff => {
      const report = reportMap.get(diff.item_code);
      if (report) {
        report.actual_qty = diff.diff;
        report.diff = diff.diff;
        report.has_diff = diff.diff !== 0;
      }
    });

    const reportList = Array.from(reportMap.values());

    // action が 'finalize' の場合、月次締め処理
    if (action === 'finalize') {
      // 冪等チェック: 同月の二重実行を防ぐ
      const existingReports = await getSupplierReportsByMonth(month);
      if (existingReports.length > 0) {
        return NextResponse.json(
          { success: false, error: `月次締め処理は既に完了しています (${month})` },
          { status: 409 }
        );
      }

      // Transactions の status を locked に更新
      for (const tx of monthTransactions) {
        await updateTransactionStatus(tx.id, 'locked');
      }

      // SupplierReports に記録
      for (const report of reportList) {
        await addSupplierReport({
          month,
          item_code: report.item_code,
          item_name: report.item_name,
          qty: report.diff,
          is_new_item: report.is_new_item,
        });
      }

      // StockLedger の期首残高を翌月用に更新
      // opening_qty = closing_qty、in_qty / out_qty = 0 にリセット
      await updateStockLedgerForMonthEnd();
    }

    return NextResponse.json({
      success: true,
      data: reportList,
      message: action === 'finalize' ? '月次締め処理を完了しました' : undefined,
    });
  } catch (error) {
    console.error('Failed to generate monthly report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate monthly report' },
      { status: 500 }
    );
  }
}
