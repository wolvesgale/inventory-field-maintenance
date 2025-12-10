/**
 * /transactions ページ - 取引一覧
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navigation } from '@/components/Navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { TransactionView } from '@/types';
import Link from 'next/link';

export default function TransactionsPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();

        if (data.success) {
          setTransactions(data.data);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold">
              {session?.user?.role === 'worker' ? 'あなたの登録履歴' : '取引一覧'}
            </h1>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 m-6 rounded">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">読み込み中...</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">取引がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-900">日付</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-900">種別</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-900">品目コード</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-900">数量</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-900">ステータス</th>
                    {session?.user?.role !== 'worker' && (
                      <th className="text-left px-6 py-3 font-medium text-gray-900">登録者</th>
                    )}
                    <th className="text-left px-6 py-3 font-medium text-gray-900">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900">{tx.date}</td>
                      <td className="px-6 py-3 text-gray-900">
                        {tx.type === 'IN' ? '入荷' : '納品・出庫'}
                      </td>
                      <td className="px-6 py-3 text-gray-900">{tx.item_code}</td>
                      <td className="px-6 py-3 text-gray-900">{tx.qty}</td>
                      <td className="px-6 py-3 text-gray-900">
                        <StatusBadge status={tx.status} />
                      </td>
                      {session?.user?.role !== 'worker' && (
                        <td className="px-6 py-3 text-gray-900">{tx.user_name}</td>
                      )}
                      <td className="px-6 py-3 text-gray-900">
                        {tx.id ? (
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="rounded border border-gray-300 px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
                          >
                            編集
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
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
