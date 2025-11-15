/**
 * API: /api/monthly-report - 月次レポート
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getTransactions,
  getItems,
  getDiffLogs,
  getPhysicalCounts,
  addSupplierReport,
  updateTransactionStatus,
} from '@/lib/sheets';
import { MonthlyReportItem } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'manager' && session.user.role !== 'admin')) {
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
          is_new_item: item?.new_flag || false,
        });
      }

      const report = reportMap.get(key)!;
      if (tx.type === 'IN') {
        report.expected_qty += tx.qty;
      } else {
        report.expected_qty -= tx.qty;
      }
    });

    // DiffLog から差異情報を関連付け
    diffs.forEach(diff => {
      const report = reportMap.get(diff.item_code);
      if (report) {
        report.actual_qty = diff.actual_qty;
        report.diff = diff.diff;
        report.has_diff = diff.diff !== 0;
      }
    });

    const reportList = Array.from(reportMap.values());

    // action が 'finalize' の場合、月次締め処理
    if (action === 'finalize') {
      // Transactions の status を locked に更新
      for (const tx of monthTransactions) {
        await updateTransactionStatus(tx.id || '', 'locked');
      }

      // Items の new_flag を FALSE に更新（create_at が対象月以前の場合）
      // Note: 簡易版のため省略。実装時は Sheets API で批量更新

      // SupplierReports に記録
      for (const report of reportList) {
        await addSupplierReport({
          month,
          item_code: report.item_code,
          item_name: report.item_name,
          qty: report.expected_qty,
          is_new_item: report.is_new_item,
        });
      }
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
