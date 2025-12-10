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
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/approve');
        const data = await response.json();

        if (data.success) {
          setTransactions(data.data);
        } else {
          setError(data.error || '取引の取得に失敗しました');
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

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateStatus = async (id: string, status: 'approved' | 'draft') => {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'status', status }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data?.error || '処理に失敗しました');
    }
  };

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    try {
      const status = action === 'approve' ? 'approved' : 'draft';
      await updateStatus(id, status);

      setTransactions(prev => prev.filter(tx => tx.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      alert((err as Error).message || '処理に失敗しました');
      console.error('Failed to approve:', err);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) {
      alert('承認する取引を選択してください');
      return;
    }

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        await updateStatus(id, 'approved');
        successCount += 1;
      }

      setTransactions(prev => prev.filter(tx => !selectedIds.has(tx.id || '')));
      setSelectedIds(new Set());
      alert(`選択した ${successCount} 件を一括承認しました`);
    } catch (err) {
      alert((err as Error).message || 'ネットワークエラーが発生しました');
      console.error('Failed to batch approve:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h1 className="text-2xl font-bold">承認待ち取引</h1>
            {transactions.length > 0 && (
              <button
                onClick={handleBatchApprove}
                disabled={selectedIds.size === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
              >
                選択した {selectedIds.size} 件を一括承認
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 m-6 rounded">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">読み込み中...</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">承認待ちの取引はありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === transactions.length && transactions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(transactions.map(tx => tx.id || '')));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left px-6 py-3 font-medium">日付</th>
                    <th className="text-left px-6 py-3 font-medium">品目コード</th>
                    <th className="text-left px-6 py-3 font-medium">数量</th>
                    <th className="text-left px-6 py-3 font-medium">種別</th>
                    <th className="text-left px-6 py-3 font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id || '')}
                          onChange={() => handleToggleSelect(tx.id || '')}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-3">{tx.date}</td>
                      <td className="px-6 py-3">{tx.item_code}</td>
                      <td className="px-6 py-3">{tx.qty}</td>
                      <td className="px-6 py-3">
                        {tx.type === 'IN' ? '入荷' : '納品・出庫'}
                      </td>
                      <td className="px-6 py-3 space-x-2">
                        <button
                          onClick={() => handleApprove(tx.id || '', 'approve')}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleApprove(tx.id || '', 'reject')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          差し戻し
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
