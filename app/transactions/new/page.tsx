/**
 * /transactions/new ページ - 入出庫登録フォーム
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Item } from '@/types';

export default function NewTransactionPage() {
  const router = useRouter();
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [isNewItem, setIsNewItem] = useState(false);
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 品目検索
  const handleItemCodeChange = useCallback(async (value: string) => {
    setItemCode(value);
    setError('');

    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/items/search?q=${encodeURIComponent(value)}`);
      const data = await response.json();

      if (data.success) {
        setSuggestions(data.data);
        const found = data.data.find((item: Item) => item.item_code === value);
        if (found) {
          setItemName(found.item_name);
          setIsNewItem(false);
        } else {
          setIsNewItem(true);
        }
      }
    } catch (err) {
      console.error('Failed to search items:', err);
    }
  }, []);

  // サジェスト選択
  const handleSelectSuggestion = (item: Item) => {
    setItemCode(item.item_code);
    setItemName(item.item_name);
    setIsNewItem(false);
    setSuggestions([]);
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // バリデーション
      if (!itemCode) {
        setError('品目コードを入力してください');
        return;
      }
      if (!qty || parseInt(qty) <= 0) {
        setError('数量は1以上の整数を入力してください');
        return;
      }
      if (isNewItem && !itemName) {
        setError('新規品目の場合、品目名を入力してください');
        return;
      }

      const response = await fetch('/api/transactions/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date,
          item_code: itemCode,
          item_name: itemName || undefined,
          qty: parseInt(qty),
          isNewItem,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '登録に失敗しました');
        return;
      }

      // 成功時、取引一覧へ遷移
      router.push('/transactions');
    } catch (err) {
      setError('ネットワークエラーが発生しました');
      console.error('Failed to submit:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">入出庫登録</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 入/出選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                取引種別
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="IN"
                    checked={type === 'IN'}
                    onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}
                    className="mr-2"
                  />
                  入荷
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="OUT"
                    checked={type === 'OUT'}
                    onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}
                    className="mr-2"
                  />
                  納品・出庫
                </label>
              </div>
            </div>

            {/* 日付 */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                日付
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* 品目コード */}
            <div>
              <label htmlFor="item_code" className="block text-sm font-medium text-gray-700 mb-1">
                品目コード
              </label>
              <input
                id="item_code"
                type="text"
                value={itemCode}
                onChange={(e) => handleItemCodeChange(e.target.value)}
                placeholder="品目コードを入力"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />

              {/* サジェスト */}
              {suggestions.length > 0 && (
                <div className="mt-2 border border-gray-300 rounded-lg overflow-hidden">
                  {suggestions.map((item) => (
                    <button
                      key={item.item_code}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <div className="font-medium">{item.item_code}</div>
                      <div className="text-sm text-gray-600">{item.item_name}</div>
                    </button>
                  ))}
                </div>
              )}

              {isNewItem && itemCode && (
                <p className="mt-2 text-orange-600 text-sm">
                  ⚠️ この品目は新規です。下の「品目名」を入力してください。
                </p>
              )}
            </div>

            {/* 品目名 (新規のみ) */}
            {isNewItem && (
              <div>
                <label htmlFor="item_name" className="block text-sm font-medium text-gray-700 mb-1">
                  品目名
                </label>
                <input
                  id="item_name"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="品目名を入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {/* 数量 */}
            <div>
              <label htmlFor="qty" className="block text-sm font-medium text-gray-700 mb-1">
                数量
              </label>
              <input
                id="qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="数量を入力"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                {isLoading ? '登録中...' : '登録'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg transition"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
