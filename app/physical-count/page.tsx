/**
 * /physical-count ページ - 棚卸
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Item } from '@/types';

interface CountItem {
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
}

export default function PhysicalCountPage() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<CountItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isPlaceholder = true;

  // 品目を取得
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items/search?q=');
        const data = await response.json();

        if (data.success) {
          setItems(data.data);
          // カウント初期化
          const initialCounts = data.data.map((item: Item) => ({
            item_code: item.item_code,
            item_name: item.item_name,
            expected_qty: 0,
            actual_qty: 0,
          }));
          setCounts(initialCounts);
        }
      } catch (err) {
        console.error('Failed to fetch items:', err);
      }
    };

    fetchItems();
  }, []);

  // カウント値の更新
  const handleCountChange = (itemCode: string, actual_qty: number) => {
    setCounts(prev =>
      prev.map(c =>
        c.item_code === itemCode ? { ...c, actual_qty } : c
      )
    );
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!location) {
      setError('場所を入力してください');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/physical-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: month,
          location,
          counts: counts.filter(c => c.actual_qty > 0),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '保存に失敗しました');
        return;
      }

      alert('棚卸結果を保存しました');
      router.push('/reports/monthly');
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

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 text-gray-900">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">棚卸（準備中）</h1>
          <p className="mb-4 text-sm text-gray-800">
            現在、この棚卸画面は将来の機能追加用のプレースホルダーです。現行の運用では使用しません（在庫管理は「在庫台帳」と「入出庫登録」を利用してください）。
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 月選択 */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                対象月
              </label>
              <input
                id="month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
                disabled={isPlaceholder || isLoading}
              />
            </div>

            {/* 場所 */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                場所
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="倉庫A など"
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
                disabled={isPlaceholder || isLoading}
              />
            </div>

            {/* 品目ごとのカウント */}
            <div>
              <h2 className="text-lg font-bold mb-4">品目カウント</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2 text-left font-medium">品目コード</th>
                      <th className="border px-4 py-2 text-left font-medium">品目名</th>
                      <th className="border px-4 py-2 text-center font-medium">実在庫数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map((count) => (
                      <tr key={count.item_code} className="hover:bg-gray-50">
                        <td className="border px-4 py-2 text-gray-900">{count.item_code}</td>
                        <td className="border px-4 py-2 text-gray-900">{count.item_name}</td>
                        <td className="border px-4 py-2">
                          <input
                            type="number"
                            value={count.actual_qty || ''}
                            onChange={(e) =>
                              handleCountChange(count.item_code, parseInt(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-gray-900"
                            min="0"
                            disabled={isPlaceholder || isLoading}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isPlaceholder || isLoading}
                className="flex-1 max-w-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isPlaceholder}
                className="flex-1 max-w-xs bg-gray-300 hover:bg-gray-400 disabled:bg-gray-300 disabled:text-gray-600 text-gray-800 font-bold py-3 px-4 rounded-lg transition"
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
