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
} from '@/lib/sheets';
import { MonthlyReportItem } from '@/types';

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
      tx.timestamp.startsWith(month) && (tx.status === 'approved' || tx.status === 'locked')
    );

    // 品目ごとに集計
    const reportMap = new Map<string, MonthlyReportItem>();

    monthTransactions.forEach(tx => {
      const key = tx.itemCode;
      if (!reportMap.has(key)) {
        const item = items.find(i => i.code === tx.itemCode);
        reportMap.set(key, {
          item_code: tx.itemCode,
          item_name: item?.name || '不明',
          expected_qty: 0,
          actual_qty: 0,
          diff: 0,
          has_diff: false,
          is_new_item: false,
        });
      }

      const report = reportMap.get(key)!;
      if (tx.type === 'add') {
        report.expected_qty += tx.quantity;
      } else {
        report.expected_qty -= tx.quantity;
      }
    });

    // DiffLog から差異情報を関連付け
    diffs.forEach(diff => {
      const report = reportMap.get(diff.itemCode);
      if (report) {
        report.actual_qty = diff.difference;
        report.diff = diff.difference;
        report.has_diff = diff.difference !== 0;
      }
    });

    const reportList = Array.from(reportMap.values());

    // action が 'finalize' の場合、月次締め処理
    if (action === 'finalize') {
      // Transactions の status を locked に更新
      for (const tx of monthTransactions) {
        await updateTransactionStatus(tx.id, 'locked');
      }

      // SupplierReports に記録
      for (const report of reportList) {
        await addSupplierReport({
          reportDate: month,
          itemId: report.item_code,
          itemCode: report.item_code,
          itemName: report.item_name,
          discrepancy: report.diff,
          reason: 'Monthly inventory check',
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
