/**
 * /stock ページ - 在庫台帳
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { NewItemBadge } from '@/components/StatusBadge';
import { StockViewItem } from '@/types';
import { GROUP_CODES, ItemGroup, getItemGroup } from '@/lib/itemGroups';

export default function StockPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<ItemGroup | 'ALL'>('ALL');

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/stock');
        const data = await response.json();

        if (data.success) {
          setStocks(data.data);
        } else {
          setError(data.error || '在庫情報の取得に失敗しました');
        }
      } catch (err) {
        setError('ネットワークエラーが発生しました');
        console.error('Failed to fetch stocks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStocks();
  }, []);

  const normalize = (value: unknown) => (value ?? '').toString().toLowerCase();

  const initialOptions = useMemo<('ALL' | ItemGroup)[]>(
    () => ['ALL', ...GROUP_CODES, 'その他'],
    []
  );

  const keyword = normalize(debouncedSearchTerm);

  const filteredStocks = stocks.filter((stock) => {
    if (groupFilter !== 'ALL') {
      const group = getItemGroup(stock.item_name ?? '');
      if (group !== groupFilter) return false;
    }

    if (!keyword) return true;

    const code = normalize(stock.item_code);
    const name = normalize(stock.item_name);
    return code.includes(keyword) || name.includes(keyword);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow text-gray-900">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold text-gray-900">在庫台帳</h1>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 m-6 rounded">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">読み込み中...</div>
          ) : stocks.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">在庫情報がありません</div>
          ) : (
            <div className="px-6 pt-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {initialOptions.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setGroupFilter(code)}
                    className={`rounded px-3 py-1 text-xs font-medium border ${
                      groupFilter === code
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {code === 'ALL' ? 'すべて' : code}
                  </button>
                ))}

                <div className="ml-auto w-full max-w-md">
                  <label htmlFor="stock-search" className="sr-only">
                    品目コード・品目名で検索
                  </label>
                  <input
                    id="stock-search"
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="品目コード・品目名で検索"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-gray-900">
                  <thead className="bg-gray-100 border-b text-gray-700">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium">品目コード</th>
                      <th className="text-left px-6 py-3 font-medium">品目名</th>
                      <th className="text-center px-6 py-3 font-medium">期首</th>
                      <th className="text-center px-6 py-3 font-medium">入庫</th>
                      <th className="text-center px-6 py-3 font-medium">出庫</th>
                      <th className="text-center px-6 py-3 font-medium">期末</th>
                      <th className="text-center px-6 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStocks.map((stock, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-3 flex items-center gap-2">
                          {stock.item_code}
                          {stock.is_new && <NewItemBadge />}
                        </td>
                        <td className="px-6 py-3">{stock.item_name}</td>
                        <td className="text-center px-6 py-3">{stock.opening_qty}</td>
                        <td className="text-center px-6 py-3 text-green-600 font-medium">
                          {stock.in_qty}
                        </td>
                        <td className="text-center px-6 py-3 text-red-600 font-medium">
                          {stock.out_qty}
                        </td>
                        <td className="text-center px-6 py-3 font-bold bg-blue-50">
                          {stock.closing_qty}
                        </td>
                        <td className="text-center px-6 py-3">
                          <button
                            type="button"
                            disabled={(stock.closing_qty ?? 0) <= 0}
                            onClick={() => router.push('/transactions/new')}
                            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            使用申請
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
