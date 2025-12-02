'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

const WAREHOUSE_OPTIONS = ['本社倉庫', '東日本センター', '西日本センター'] as const;
const TRANSACTION_TYPES = ['棚卸', '入庫', '出庫'] as const;

type WarehouseOption = (typeof WAREHOUSE_OPTIONS)[number];
type TransactionTypeOption = (typeof TRANSACTION_TYPES)[number];

type ItemCandidate = {
  item_code: string;
  item_name: string;
};

interface TransactionFormState {
  date: string;
  base: WarehouseOption;
  location: string;
  itemName: string;
  itemCode: string;
  quantity: string;
  transactionType: TransactionTypeOption;
  memo: string;
}

interface TransactionRequestPayload {
  date: string;
  base: string;
  location: string;
  itemName: string;
  itemCode?: string;
  quantity: number;
  transactionType: TransactionTypeOption;
  memo?: string;
}

const createInitialState = (): TransactionFormState => ({
  date: new Date().toISOString().split('T')[0],
  base: WAREHOUSE_OPTIONS[0],
  location: '',
  itemName: '',
  itemCode: '',
  quantity: '',
  transactionType: TRANSACTION_TYPES[0],
  memo: '',
});

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">フォームを読み込み中です…</div>}>
      <NewTransactionForm />
    </Suspense>
  );
}

function NewTransactionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [form, setForm] = useState<TransactionFormState>(() => createInitialState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');
  const [itemCandidates, setItemCandidates] = useState<ItemCandidate[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [router, status]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedItemSearch(itemSearch);
    }, 300);

    return () => clearTimeout(handle);
  }, [itemSearch]);

  useEffect(() => {
    const keyword = debouncedItemSearch.trim();
    if (!keyword) {
      setItemCandidates([]);
      setShowItemDropdown(false);
      return;
    }

    const fetchItems = async () => {
      const response = await fetch(`/api/items/search?q=${encodeURIComponent(keyword)}`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const candidates: unknown = data?.data ?? data?.items ?? data;
      if (!Array.isArray(candidates)) {
        setItemCandidates([]);
        setShowItemDropdown(false);
        return;
      }

      const mapped = candidates
        .map((candidate) => ({
          item_code: (candidate as ItemCandidate).item_code,
          item_name: (candidate as ItemCandidate).item_name,
        }))
        .filter((candidate) => candidate.item_code && candidate.item_name);

      setItemCandidates(mapped);
      setShowItemDropdown(mapped.length > 0);
    };

    fetchItems().catch((error) => {
      console.error('Failed to search items', error);
      setItemCandidates([]);
      setShowItemDropdown(false);
    });
  }, [debouncedItemSearch]);

  const isFormDisabled = useMemo(() => status !== 'authenticated', [status]);

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

  const handleFieldChange = (field: keyof TransactionFormState) => (
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    if (hasPrefilled) return;

    const prefillItemName = searchParams?.get('itemName') ?? '';
    const prefillItemCode = searchParams?.get('itemCode') ?? '';
    const prefillTypeParam = searchParams?.get('type') ?? '';

    if (prefillItemName || prefillItemCode || prefillTypeParam) {
      setForm((prev) => ({
        ...prev,
        itemName: prefillItemName || prev.itemName,
        itemCode: prefillItemCode || prev.itemCode,
        transactionType: prefillTypeParam.toUpperCase() === 'USE' ? '出庫' : prev.transactionType,
      }));
      setItemSearch(prefillItemName || prefillItemCode);
    }

    setHasPrefilled(true);
  }, [hasPrefilled, searchParams]);

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

    const quantityValue = Number(form.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue === 0) {
      setSubmitError('数量は0以外の数値を入力してください');
      return;
    }

    const payload: TransactionRequestPayload = {
      date: form.date,
      base: form.base,
      location: form.location.trim(),
      itemName: form.itemName.trim(),
      itemCode: form.itemCode.trim() || undefined,
      quantity: quantityValue,
      transactionType: form.transactionType,
      memo: form.memo.trim() || undefined,
    };

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !data.success) {
        throw new Error(data.error || '登録に失敗しました');
      }

      window.alert('登録しました');
      setForm(createInitialState());
      setItemSearch('');
      setItemCandidates([]);
      setShowItemDropdown(false);
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
          <h1 className="text-2xl font-bold text-gray-900">棚卸／在庫移動 登録</h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            ダッシュボードへ戻る
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          {submitError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div>
              <label htmlFor="base" className="mb-2 block text-sm font-medium text-gray-700">
                拠点
              </label>
              <select
                id="base"
                value={form.base}
                onChange={(event) => handleFieldChange('base')(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isFormDisabled}
              >
                {WAREHOUSE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* 棚/ロケーション（現状未使用のため非表示） */}
            <input
              type="hidden"
              name="location"
              value={form.location}
              onChange={(event) => handleFieldChange('location')(event.target.value)}
            />

            <div>
              <label htmlFor="itemName" className="mb-2 block text-sm font-medium text-gray-700">
                品目名
              </label>
              <div className="relative">
                <input
                  id="itemName"
                  type="text"
                  value={itemSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setItemSearch(value);
                    setForm((prev) => ({ ...prev, itemName: value, itemCode: '' }));
                  }}
                  placeholder="品目名または品目コードで検索"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  disabled={isFormDisabled}
                  onFocus={() => setShowItemDropdown(itemCandidates.length > 0)}
                />
                {showItemDropdown && itemCandidates.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-gray-200 bg-white text-sm shadow">
                    {itemCandidates.map((item) => (
                      <li
                        key={item.item_code}
                        className="cursor-pointer px-3 py-2 text-gray-900 hover:bg-blue-50"
                        onClick={() => {
                          setItemSearch(item.item_name);
                          setShowItemDropdown(false);
                          setForm((prev) => ({
                            ...prev,
                            itemName: item.item_name,
                            itemCode: item.item_code,
                          }));
                        }}
                      >
                        <div className="font-medium text-gray-900">{item.item_name}</div>
                        <div className="text-xs text-gray-600">{item.item_code}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700">
                数量（マイナス値可）
              </label>
              <input
                id="quantity"
                type="number"
                value={form.quantity}
                onChange={(event) => handleFieldChange('quantity')(event.target.value)}
                placeholder="例：10 または -3"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                step="1"
                disabled={isFormDisabled}
              />
            </div>

            <div>
              <label htmlFor="transactionType" className="mb-2 block text-sm font-medium text-gray-700">
                取引種別
              </label>
              <select
                id="transactionType"
                value={form.transactionType}
                onChange={(event) => handleFieldChange('transactionType')(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isFormDisabled}
              >
                {TRANSACTION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

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

            <div>
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                disabled={isSubmitting || isFormDisabled}
              >
                {isSubmitting ? '送信中...' : '登録'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
