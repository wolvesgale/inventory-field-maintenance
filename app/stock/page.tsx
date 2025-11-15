/**
 * /stock ページ - 在庫台帳
 */

'use client';

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { NewItemBadge } from '@/components/StatusBadge';
import { StockViewItem } from '@/types';

export default function StockPage() {
  const [stocks, setStocks] = useState<StockViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold">在庫台帳</h1>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">品目コード</th>
                    <th className="text-left px-6 py-3 font-medium">品目名</th>
                    <th className="text-center px-6 py-3 font-medium">期首</th>
                    <th className="text-center px-6 py-3 font-medium">入庫</th>
                    <th className="text-center px-6 py-3 font-medium">出庫</th>
                    <th className="text-center px-6 py-3 font-medium">期末</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, idx) => (
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
