/**
 * /transactions ページ - 取引一覧
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Navigation } from '@/components/Navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Transaction } from '@/types';

export default function TransactionsPage() {
  const { user, status } = useSession();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingError, setPendingError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();

        if (data.success) {
          const sorted = (data.data as Transaction[])
            .slice()
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setTransactions(sorted);
        } else {
          setError(data.error || '取引一覧の取得に失敗しました');
        }
      } catch (err) {
        setError('ネットワークエラーが発生しました');
        console.error('Failed to fetch transactions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchPending = async () => {
      try {
        const response = await fetch('/api/transactions/pending');
        const data = await response.json();

        if (data.success) {
          const sorted = (data.data as Transaction[])
            .filter((tx) => tx.status === 'pending' && tx.type === 'OUT')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setPendingTransactions(sorted);
        } else {
          setPendingError(data.error || '未承認申請の取得に失敗しました');
        }
      } catch (err) {
        setPendingError('ネットワークエラーが発生しました');
        console.error('Failed to fetch pending transactions:', err);
      } finally {
        setIsPendingLoading(false);
      }
    };
    fetchPending();
  }, [status]);

  const userId = user?.id;

  const statusLabel = useMemo(
    () => ({
      draft: '下書き',
      pending: '申請中',
      approved: '承認済み',
      locked: 'ロック中',
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold text-gray-900">未承認の使用申請</h1>
          </div>
          <div className="px-6 py-4">
            {pendingError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pendingError}</div>
            )}
            {isPendingLoading ? (
              <div className="text-sm text-gray-600">未承認申請を読み込み中...</div>
            ) : pendingTransactions.length === 0 ? (
              <div className="text-sm text-gray-600">未承認の使用申請はありません。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-800">
                  <thead className="bg-gray-100 border-b text-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">日付</th>
                      <th className="px-4 py-2 text-left font-medium">種別</th>
                      <th className="px-4 py-2 text-left font-medium">品目コード</th>
                      <th className="px-4 py-2 text-left font-medium">品目名</th>
                      <th className="px-4 py-2 text-right font-medium">数量</th>
                      <th className="px-4 py-2 text-left font-medium">拠点</th>
                      <th className="px-4 py-2 text-left font-medium">申請者</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{tx.date}</td>
                        <td className="px-4 py-2">{tx.type === 'IN' ? '入庫' : '出庫'}</td>
                        <td className="px-4 py-2">{tx.item_code}</td>
                        <td className="px-4 py-2">{tx.item_name}</td>
                        <td className="px-4 py-2 text-right">{tx.qty}</td>
                        <td className="px-4 py-2">{tx.area}</td>
                        <td className="px-4 py-2">{tx.user_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">取引履歴</h2>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 m-6 rounded">{error}</div>
          )}
          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">読み込み中...</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">取引がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-800">
                <thead className="bg-gray-100 border-b text-gray-800">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">日付</th>
                    <th className="text-left px-6 py-3 font-medium">種別</th>
                    <th className="text-left px-6 py-3 font-medium">品目コード</th>
                    <th className="text-left px-6 py-3 font-medium">品目名</th>
                    <th className="text-right px-6 py-3 font-medium">数量</th>
                    <th className="text-left px-6 py-3 font-medium">拠点</th>
                    <th className="text-left px-6 py-3 font-medium">ステータス</th>
                    <th className="text-left px-6 py-3 font-medium">登録者</th>
                    <th className="text-left px-6 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => {
                    const canEdit = userId && tx.user_id === userId && tx.status !== 'approved';
                    return (
                      <tr key={tx.id ?? `${tx.item_code}-${tx.date}-${tx.user_id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-3">{tx.date}</td>
                        <td className="px-6 py-3">{tx.type === 'IN' ? '入庫' : '出庫'}</td>
                        <td className="px-6 py-3">{tx.item_code}</td>
                        <td className="px-6 py-3">{tx.item_name}</td>
                        <td className="px-6 py-3 text-right">{tx.qty}</td>
                        <td className="px-6 py-3">{tx.area}</td>
                        <td className="px-6 py-3">
                          <StatusBadge status={tx.status} />
                          <span className="sr-only">{statusLabel[tx.status]}</span>
                        </td>
                        <td className="px-6 py-3">{tx.user_name}</td>
                        <td className="px-6 py-3">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => router.push(`/transactions/new?editId=${tx.id}`)}
                            className="rounded border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            編集
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
