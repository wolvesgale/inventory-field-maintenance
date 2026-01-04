/**
 * /reports/monthly ページ - 月次レポート
 */

'use client';

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { MonthlyReportItem } from '@/types';

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reports, setReports] = useState<MonthlyReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // レポート取得
  const handleFetchReport = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, action: 'preview' }),
      });

      const data = await response.json();

      if (data.success) {
        setReports(data.data);
      } else {
        setError(data.error || 'レポート取得に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
      console.error('Failed to fetch report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 月次締め処理
  const handleFinalize = async () => {
    if (!window.confirm('本当に月次締め処理を実行しますか？この操作は取り消せません。')) {
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, action: 'finalize' }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || '月次締め処理が完了しました');
        setReports(data.data);
      } else {
        setError(data.error || '月次締め処理に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
      console.error('Failed to finalize:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 新規品目フィルタ
  const newItems = reports.filter(r => r.is_new_item);
  const diffItems = reports.filter(r => r.has_diff);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* コントロール */}
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-2 text-gray-900">月次レポート</h1>
            <p className="mt-2 text-sm text-gray-700">
              この画面は将来の月次レポート機能拡張用のプレースホルダーです。今後、在庫差異レポートや月次集計の出力などを追加予定です。
            </p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-4 items-end">
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                  対象月
                </label>
                <input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleFetchReport}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
              >
                {isLoading ? '取得中...' : '取得'}
              </button>
            </div>
          </div>

          {reports.length > 0 && (
            <>
              {/* 新規品目 */}
              {newItems.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">新規型番リスト</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left px-6 py-3 font-medium">品目コード</th>
                          <th className="text-left px-6 py-3 font-medium">品目名</th>
                          <th className="text-center px-6 py-3 font-medium">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newItems.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50 bg-red-50">
                            <td className="px-6 py-3">{item.item_code}</td>
                            <td className="px-6 py-3">{item.item_name}</td>
                            <td className="text-center px-6 py-3">{item.expected_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 差異あり */}
              {diffItems.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">差異ありの品目</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left px-6 py-3 font-medium">品目コード</th>
                          <th className="text-left px-6 py-3 font-medium">品目名</th>
                          <th className="text-center px-6 py-3 font-medium">予定数</th>
                          <th className="text-center px-6 py-3 font-medium">実績数</th>
                          <th className="text-center px-6 py-3 font-medium">差異</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffItems.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50 bg-yellow-50">
                            <td className="px-6 py-3">{item.item_code}</td>
                            <td className="px-6 py-3">{item.item_name}</td>
                            <td className="text-center px-6 py-3">{item.expected_qty}</td>
                            <td className="text-center px-6 py-3">{item.actual_qty}</td>
                            <td className="text-center px-6 py-3 font-bold text-red-600">
                              {item.diff > 0 ? '+' : ''}{item.diff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 月次締め */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">月次締め処理</h2>
                <p className="text-gray-600 mb-4">
                  すべてのデータ確認が完了したら、以下を実行してください：
                </p>
                <ul className="list-disc list-inside text-gray-600 mb-6">
                  <li>すべての取引が正しく記録されている</li>
                  <li>差異が確認・対応された</li>
                  <li>新規型番の確認完了</li>
                </ul>
                <button
                  onClick={handleFinalize}
                  disabled={isProcessing}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded"
                >
                  {isProcessing ? '処理中...' : '月次締め実行'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
