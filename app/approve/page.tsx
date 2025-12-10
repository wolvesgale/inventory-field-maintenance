/**
 * /approve ページ - 取引承認
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navigation } from '@/components/Navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Transaction } from '@/types';

export default function ApprovePage() {
  useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/approve');
        const data = await response.json();

        if (response.ok && data.success) {
          setTransactions(data.data as Transaction[]);
        } else {
          throw new Error(data.error || '承認待ち取引の取得に失敗しました');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '承認待ち取引の取得に失敗しました');
        console.error('Failed to fetch transactions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: id, action: 'approve' }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      } else {
        alert(data.error || '承認に失敗しました');
      }
    } catch (err) {
      alert('ネットワークエラーが発生しました');
      console.error('Failed to approve:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold text-gray-900">承認待ち取引</h1>
          </div>

          {error && (
            <div className="m-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-600">読み込み中...</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-600">承認待ちの取引はありません</div>
          ) : (
            <div className="overflow-x-auto px-6 py-4">
              <table className="w-full text-sm text-gray-900">
                <thead className="bg-gray-100 border-b text-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">日付</th>
                    <th className="px-4 py-2 text-left font-medium">種別</th>
                    <th className="px-4 py-2 text-left font-medium">品目コード</th>
                    <th className="px-4 py-2 text-left font-medium">品目名</th>
                    <th className="px-4 py-2 text-right font-medium">数量</th>
                    <th className="px-4 py-2 text-left font-medium">拠点</th>
                    <th className="px-4 py-2 text-left font-medium">登録者</th>
                    <th className="px-4 py-2 text-left font-medium">ステータス</th>
                    <th className="px-4 py-2 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{tx.date}</td>
                      <td className="px-4 py-2">{tx.type === 'IN' ? '入庫' : '出庫'}</td>
                      <td className="px-4 py-2">{tx.item_code}</td>
                      <td className="px-4 py-2">{tx.item_name}</td>
                      <td className="px-4 py-2 text-right">{tx.qty}</td>
                      <td className="px-4 py-2">{tx.area}</td>
                      <td className="px-4 py-2">{tx.user_name}</td>
                      <td className="px-4 py-2"><StatusBadge status={tx.status} /></td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(tx.id || '')}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                        >
                          承認
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
