/**
 * /approve ページ - 取引承認
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Navigation } from '@/components/Navigation';
import { Transaction } from '@/types';

export default function ApprovePage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [returnTargetIds, setReturnTargetIds] = useState<string[]>([]);
  const [returnTargetNames, setReturnTargetNames] = useState<string[]>([]);
  const [returnError, setReturnError] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

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

  const updateStatus = async (
    id: string,
    status: 'approved' | 'returned',
    options?: { returnComment?: string },
  ) => {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'status',
        status,
        approvedBy: session?.user?.name ?? session?.user?.login_id ?? '',
        returnComment: options?.returnComment,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data?.error || '処理に失敗しました');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateStatus(id, 'approved');

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
        try {
          await updateStatus(id, 'approved');
          successCount += 1;
        } catch (err) {
          console.error('[bulk approve] failed', id, err);
        }
      }

      if (successCount > 0) {
        alert(`選択した ${successCount} 件を一括承認しました`);
        setTransactions(prev => prev.filter(tx => !selectedIds.has(tx.id || '')));
        setSelectedIds(new Set());
      }
    } catch (err) {
      alert((err as Error).message || 'ネットワークエラーが発生しました');
      console.error('Failed to batch approve:', err);
    }
  };

  const openReturnModal = (ids: string[], requesterNames: string[]) => {
    const validIds = ids.filter(Boolean);
    if (validIds.length === 0) return;

    const uniqueNames = Array.from(new Set(requesterNames.filter(Boolean)));
    setReturnTargetIds(validIds);
    setReturnTargetNames(uniqueNames);
    setReturnComment('');
    setReturnError('');
    setReturnModalOpen(true);
  };

  const handleReturnClick = (tx: Transaction) => {
    openReturnModal([tx.id || ''], [tx.user_name || tx.user_id || '']);
  };

  const handleBatchReturn = () => {
    if (selectedIds.size === 0) {
      alert('差し戻す取引を選択してください');
      return;
    }

    const ids = Array.from(selectedIds).filter(Boolean);
    const names = transactions
      .filter((tx) => tx.id && selectedIds.has(tx.id))
      .map((tx) => tx.user_name || tx.user_id || '');

    openReturnModal(ids, names);
  };

  const handleSubmitReturn = async () => {
    const comment = returnComment.trim();
    if (!comment) {
      setReturnError('差し戻しコメントを入力してください');
      return;
    }

    setIsSubmittingReturn(true);
    const succeededIds: string[] = [];

    try {
      for (const id of returnTargetIds) {
        try {
          await updateStatus(id, 'returned', { returnComment: comment });
          succeededIds.push(id);
        } catch (err) {
          console.error('[return] failed', id, err);
        }
      }

      if (succeededIds.length > 0) {
        setTransactions((prev) => prev.filter((tx) => !succeededIds.includes(tx.id || '')));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          succeededIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (succeededIds.length === returnTargetIds.length) {
        setReturnModalOpen(false);
      } else {
        setReturnError('一部の差し戻しに失敗しました。');
      }
    } finally {
      setIsSubmittingReturn(false);
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
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBatchApprove}
                  disabled={selectedIds.size === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
                >
                  選択した {selectedIds.size} 件を一括承認
                </button>
                <button
                  onClick={handleBatchReturn}
                  disabled={selectedIds.size === 0}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
                >
                  選択した {selectedIds.size} 件を一括差し戻し
                </button>
              </div>
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
                    <th className="text-left px-6 py-3 font-medium">依頼者</th>
                    <th className="text-left px-6 py-3 font-medium">品目コード</th>
                    <th className="text-left px-6 py-3 font-medium">品名</th>
                    <th className="text-left px-6 py-3 font-medium">数量</th>
                    <th className="text-left px-6 py-3 font-medium">種別</th>
                    <th className="text-left px-6 py-3 font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
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
                      <td className="px-6 py-3">{tx.user_name || tx.user_id}</td>
                      <td className="px-6 py-3">{tx.item_code}</td>
                      <td className="px-6 py-3">{tx.item_name}</td>
                      <td className="px-6 py-3">{tx.qty}</td>
                      <td className="px-6 py-3">
                        {tx.type === 'IN' ? '入庫' : '出庫'}
                      </td>
                      <td className="px-6 py-3 space-x-2">
                        <button
                          onClick={() => handleApprove(tx.id || '')}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleReturnClick(tx)}
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

      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-3">差し戻し</h2>
            <p className="text-sm text-gray-700">
              対象件数: <span className="font-semibold">{returnTargetIds.length}</span> 件
            </p>
            <div className="mt-3">
              <div className="text-sm font-semibold text-gray-800">依頼者</div>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                {(returnTargetNames.length > 0 ? returnTargetNames : ['情報なし']).map(
                  (name, idx) => (
                    <li key={`${name}-${idx}`}>{name || '情報なし'}</li>
                  ),
                )}
              </ul>
            </div>

            <div className="mt-4">
              <label
                htmlFor="return-comment"
                className="mb-1 block text-sm font-medium text-gray-800"
              >
                差し戻しコメント（必須）
              </label>
              <textarea
                id="return-comment"
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={4}
                required
              />
              {returnError && <p className="mt-1 text-sm text-red-600">{returnError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isSubmittingReturn) return;
                  setReturnModalOpen(false);
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-70"
                disabled={isSubmittingReturn}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmitReturn}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? '送信中...' : '差し戻す'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
