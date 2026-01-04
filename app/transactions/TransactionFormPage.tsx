'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ITEM_GROUP_LABELS,
  type ItemGroupKey,
  isItemGroupKey,
  resolveGroupFromInitial,
} from '@/lib/itemGroups';
import { StatusBadge } from '@/components/StatusBadge';
import { Transaction } from '@/types';

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'IN', label: '入庫' },
  { value: 'OUT', label: '出庫' },
] as const;

type TransactionType = (typeof TRANSACTION_TYPE_OPTIONS)[number]['value'];

type ItemCandidate = {
  item_code: string;
  item_name: string;
  group: ItemGroupKey;
};

const GROUP_BUTTONS: { key: ItemGroupKey; label: string }[] = [
  { key: 'ALL', label: ITEM_GROUP_LABELS.ALL },
  { key: 'SAD', label: ITEM_GROUP_LABELS.SAD },
  { key: 'BU', label: ITEM_GROUP_LABELS.BU },
  { key: 'CA', label: ITEM_GROUP_LABELS.CA },
  { key: 'FR', label: ITEM_GROUP_LABELS.FR },
  { key: 'EG', label: ITEM_GROUP_LABELS.EG },
  { key: 'CF', label: ITEM_GROUP_LABELS.CF },
  { key: 'MA', label: ITEM_GROUP_LABELS.MA },
  { key: 'OTHER', label: ITEM_GROUP_LABELS.OTHER },
];

interface TransactionFormState {
  date: string;
  location: string;
  itemName: string;
  itemCode: string;
  quantity: string;
  transactionType: TransactionType;
  memo: string;
}

interface TransactionRequestPayload {
  date: string;
  location?: string;
  item_code: string;
  item_name: string;
  qty: number;
  type: TransactionType;
  reason?: string;
}

interface TransactionFormPageProps {
  initialEditId?: string | null;
}

const createInitialState = (): TransactionFormState => ({
  date: new Date().toISOString().split('T')[0],
  location: '',
  itemName: '',
  itemCode: '',
  quantity: '',
  transactionType: 'OUT',
  memo: '',
});

const normalize = (value: unknown) => (value ?? '').toString();

export default function TransactionFormPage({ initialEditId }: TransactionFormPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [form, setForm] = useState<TransactionFormState>(() => createInitialState());
  const [itemGroup, setItemGroup] = useState<ItemGroupKey>('ALL');
  const [itemQuery, setItemQuery] = useState('');
  const [debouncedItemQuery, setDebouncedItemQuery] = useState('');
  const [itemCandidates, setItemCandidates] = useState<ItemCandidate[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [isStockLoading, setIsStockLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const [editId, setEditId] = useState<string | null>(initialEditId ?? null);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [loadedTxMeta, setLoadedTxMeta] = useState<Transaction | null>(null);

  useEffect(() => {
    setEditId(initialEditId ?? null);
  }, [initialEditId]);

  // 認証チェック
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // itemQuery デバウンス
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedItemQuery(itemQuery.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [itemQuery]);

  // 編集モードの初期データ取得
  useEffect(() => {
    if (!editId) {
      setIsEditMode(false);
      setForm(createInitialState());
      setLoadedTxMeta(null);
      return;
    }

    const fetchTransaction = async () => {
      try {
        const res = await fetch(`/api/transactions/${editId}`);
        if (!res.ok) {
          throw new Error('取引情報の取得に失敗しました');
        }
        const data = await res.json();
        if (!data?.success || !data?.data) {
          throw new Error(data.error || '取引情報の取得に失敗しました');
        }

        const tx = data.data as Transaction & { initial_group?: string };

        setForm({
          date: tx.date,
          // Transaction 型に location は存在しないため、編集時も空文字にしておく
          location: '',
          itemName: tx.item_name,
          itemCode: tx.item_code ?? '',
          quantity: String(tx.qty),
          transactionType: tx.type,
          memo: tx.reason ?? '',
        });

        setLoadedTxMeta(tx);
        setItemQuery(tx.item_name);
        setItemGroup(resolveGroupFromInitial(tx.initial_group));

        setIsEditMode(true);
      } catch (error) {
        console.error(error);
        setSubmitError(
          error instanceof Error ? error.message : '編集対象の取引を読み込めませんでした',
        );
      }
    };

    fetchTransaction();
  }, [editId]);

  // 品目サジェスト取得
  useEffect(() => {
    let cancelled = false;

    const fetchSuggestions = async () => {
      try {
        setIsLoadingItems(true);

        const params = new URLSearchParams();
        params.set('group', itemGroup);
        if (debouncedItemQuery) {
          params.set('q', debouncedItemQuery);
        }

        const res = await fetch(`/api/items/search?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`品目検索に失敗しました: ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;

        const raw = (data?.items ?? data?.data ?? data) as unknown;
        const arr = Array.isArray(raw) ? raw : [];

        const mapped: ItemCandidate[] = arr
          .map((row: any) => ({
            item_code: normalize(row.item_code),
            item_name: normalize(row.item_name),
            group: isItemGroupKey(row.group) ? row.group : 'OTHER',
          }))
          .filter((row) => row.item_code && row.item_name);

        setItemCandidates(mapped);
        setShowItemDropdown(mapped.length > 0);
      } catch (error) {
        console.error('Failed to fetch item suggestions', error);
        if (!cancelled) {
          setItemCandidates([]);
          setShowItemDropdown(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingItems(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [debouncedItemQuery, itemGroup]);

  // 品目コードに基づいて在庫数取得
  useEffect(() => {
    if (!form.itemCode) {
      setCurrentStock(null);
      return;
    }

    let cancelled = false;
    setIsStockLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/stock?itemCode=${encodeURIComponent(form.itemCode)}`);
        if (!res.ok) throw new Error('failed to fetch stock');
        const data = await res.json();
        if (cancelled) return;

        const raw = (data?.data ?? data) as any;
        const entry = Array.isArray(raw) ? raw[0] : raw;
        if (!entry) {
          setCurrentStock(0);
          return;
        }

        const qtyValue =
          entry.closing_qty ?? entry.currentQuantity ?? entry.quantity ?? entry.total_qty ?? 0;
        const qtyNumber = Number(qtyValue);
        setCurrentStock(Number.isFinite(qtyNumber) ? qtyNumber : 0);
      } catch (error) {
        console.error('failed to load stock', error);
        if (!cancelled) setCurrentStock(null);
      } finally {
        if (!cancelled) setIsStockLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.itemCode]);

  // 未承認の申請一覧（新規モードのみ）
  useEffect(() => {
    if (isEditMode) return;

    let cancelled = false;
    setIsLoadingPending(true);

    (async () => {
      try {
        const res = await fetch('/api/transactions?status=pending');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        const list = (data?.data ?? data?.transactions ?? []) as Transaction[];
        setPendingTransactions(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('failed to load pending transactions', error);
      } finally {
        if (!cancelled) setIsLoadingPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode]);

  const isFormDisabled = status !== 'authenticated';

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        読み込み中...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        ログインページへ移動しています...
      </div>
    );
  }

  const handleFieldChange =
    (field: keyof TransactionFormState) => (value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!form.date) {
      setSubmitError('日付を選択してください');
      return;
    }

    if (!form.itemName.trim()) {
      setSubmitError('品目名を入力してください');
      return;
    }

    if (!form.itemCode.trim()) {
      setSubmitError('品目候補を選択してください');
      return;
    }

    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setSubmitError('数量は0以外の数値を入力してください');
      return;
    }

    const normalizedType: TransactionType = qty > 0 ? 'IN' : 'OUT';
    const payload: TransactionRequestPayload = {
      date: form.date,
      location: form.location.trim() || undefined,
      item_code: form.itemCode.trim(),
      item_name: form.itemName.trim(),
      qty: Math.abs(qty),
      type: normalizedType,
      reason: form.memo.trim() || undefined,
    };

    setIsSubmitting(true);

    try {
      const url = isEditMode && editId ? `/api/transactions/${editId}` : '/api/transactions/new';
      const method = isEditMode && editId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || '登録に失敗しました');
      }

      window.alert(isEditMode ? '取引を更新しました' : '取引を登録しました');

      if (isEditMode) {
        router.push('/transactions');
      } else {
        setForm(createInitialState());
        setItemQuery('');
        setItemCandidates([]);
        setShowItemDropdown(false);
        setItemGroup('ALL');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '登録に失敗しました';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? '取引の編集' : '入出庫／使用申請 登録'}
          </h1>
          <button
            type="button"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボードへ戻る
          </button>
        </div>
        {session?.user?.area && (
          <p className="mb-4 text-sm text-gray-700">
            ログイン拠点: <span className="font-semibold">{session.user.area}</span>
          </p>
        )}

        <div className="bg-white rounded-xl shadow p-6">
          {submitError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {isEditMode && loadedTxMeta && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">ステータス:</span>
                  <StatusBadge status={loadedTxMeta.status} />
                </div>
                <div>
                  <span className="font-semibold">依頼者:</span>{' '}
                  {loadedTxMeta.user_name || loadedTxMeta.user_id || '-'}
                </div>
                <div>
                  <span className="font-semibold">拠点:</span> {loadedTxMeta.area || '-'}
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-gray-800 sm:grid-cols-2">
                <div>承認者: {loadedTxMeta.approved_by || loadedTxMeta.approvedBy || '-'}</div>
                <div>承認日時: {loadedTxMeta.approved_at || loadedTxMeta.approvedAt || '-'}</div>
                <div>差し戻し: {loadedTxMeta.returnedBy || '-'}</div>
                <div>差し戻し日時: {loadedTxMeta.returnedAt || '-'}</div>
              </div>
              {loadedTxMeta.returnComment && (
                <div className="mt-3 text-sm text-gray-800">
                  <div className="font-semibold">差し戻しコメント</div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{loadedTxMeta.returnComment}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 日付 */}
            <div>
              <label htmlFor="date" className="mb-2 block text-sm font-medium text-gray-700">
                日付
              </label>
              <input
                id="date"
                type="date"
                value={form.date}
                onChange={(event) => handleFieldChange('date')(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                disabled={isFormDisabled}
              />
            </div>

            {/* 保管場所 */}
            <div>
              <label htmlFor="location" className="mb-2 block text-sm font-medium text-gray-700">
                保管場所（任意）
              </label>
              <input
                id="location"
                type="text"
                value={form.location}
                onChange={(event) => handleFieldChange('location')(event.target.value)}
                placeholder="例：冷蔵庫、棚番号など"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isFormDisabled}
              />
            </div>

            {/* 品目 */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {GROUP_BUTTONS.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setItemGroup(group.key)}
                    className={`rounded px-3 py-1 text-xs font-medium border ${
                      itemGroup === group.key
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-300 bg-white text-gray-700'
                    }`}
                    disabled={isFormDisabled}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {/* キーワード検索＋サジェスト */}
              <div className="relative space-y-2">
                <input
                  type="text"
                  value={itemQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setItemQuery(value);
                    setForm((prev) => ({ ...prev, itemName: value, itemCode: '' }));
                  }}
                  placeholder="品目名または品目コードで検索"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  disabled={isFormDisabled}
                  onFocus={() => {
                    if (itemCandidates.length > 0) setShowItemDropdown(true);
                  }}
                />

                {isLoadingItems && (
                  <div className="text-xs text-gray-500">品目候補を読み込み中...</div>
                )}

                {showItemDropdown && itemCandidates.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-gray-200 bg-white text-sm shadow">
                    {itemCandidates.map((item) => (
                      <li
                        key={item.item_code}
                        className="cursor-pointer px-3 py-2 hover:bg-blue-50"
                        onClick={() => {
                          setItemQuery(item.item_name);
                          setForm((prev) => ({
                            ...prev,
                            itemName: item.item_name,
                            itemCode: item.item_code,
                          }));
                          setShowItemDropdown(false);
                        }}
                      >
                        <div className="font-medium text-gray-900">{item.item_name}</div>
                        <div className="text-xs text-gray-600">{item.item_code}</div>
                      </li>
                    ))}
                  </ul>
                )}

                {isStockLoading ? (
                  <p className="text-xs text-gray-500">現在庫数を取得中...</p>
                ) : currentStock !== null ? (
                  <p className="text-xs text-gray-800">
                    現在庫数: <span className="font-semibold">{currentStock}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* 数量 */}
            <div>
              <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700">
                数量（0 以外）
              </label>
              <input
                id="quantity"
                type="number"
                value={form.quantity}
                onChange={(event) => {
                  const value = event.target.value;
                  const qtyNumber = Number(value);

                  setForm((prev) => ({
                    ...prev,
                    quantity: value,
                    transactionType:
                      !Number.isNaN(qtyNumber) && qtyNumber !== 0
                        ? qtyNumber > 0
                          ? 'IN'
                          : 'OUT'
                        : prev.transactionType,
                  }));
                }}
                placeholder="例：10 または -3"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                step="1"
                disabled={isFormDisabled}
              />
            </div>

            {/* 取引種別 */}
            <div>
              <label
                htmlFor="transactionType"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                取引種別
              </label>
              <select
                id="transactionType"
                value={form.transactionType}
                onChange={(event) =>
                  handleFieldChange('transactionType')(event.target.value as TransactionType)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isFormDisabled}
              >
                {TRANSACTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* メモ */}
            <div>
              <label htmlFor="memo" className="mb-2 block text-sm font-medium text-gray-700">
                メモ（任意）
              </label>
              <textarea
                id="memo"
                value={form.memo}
                onChange={(event) => handleFieldChange('memo')(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="特記事項があれば入力"
                disabled={isFormDisabled}
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                disabled={isSubmitting || isFormDisabled}
              >
                {isSubmitting
                  ? '送信中...'
                  : isEditMode
                  ? 'この内容で更新する'
                  : 'この内容で登録する'}
              </button>
              {!isEditMode && (
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setForm(createInitialState());
                    setItemQuery('');
                    setItemCandidates([]);
                    setShowItemDropdown(false);
                    setItemGroup('ALL');
                    setSubmitError(null);
                  }}
                  disabled={isSubmitting || isFormDisabled}
                >
                  入力リセット
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {!isEditMode && (
        <div className="max-w-5xl mx-auto px-4 mt-8">
          <section className="bg-white rounded-lg shadow px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">承認待ちの申請一覧</h2>

            {isLoadingPending ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : pendingTransactions.length === 0 ? (
              <p className="text-sm text-gray-500">承認待ちの申請はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b text-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">日付</th>
                      <th className="px-3 py-2 text-left font-medium">拠点</th>
                      <th className="px-3 py-2 text-left font-medium">品目コード</th>
                      <th className="px-3 py-2 text-left font-medium">数量</th>
                      <th className="px-3 py-2 text-left font-medium">登録者</th>
                      <th className="px-3 py-2 text-left font-medium">ステータス</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {pendingTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{tx.date}</td>
                        <td className="px-3 py-2">{tx.area}</td>
                        <td className="px-3 py-2">{tx.item_code}</td>
                        <td className="px-3 py-2">{tx.qty}</td>
                        <td className="px-3 py-2">{tx.user_name || tx.user_id}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
