'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/clientSession';
import { Navigation } from '@/components/Navigation';
import type { AppUser } from '@/lib/sheets';

export default function UsersPage() {
  const { user, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
      router.push('/');
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (data.success) {
          setUsers(data.data as AppUser[]);
        } else {
          setError(data.error || 'ユーザー一覧の取得に失敗しました');
        }
      } catch (err) {
        setError('ユーザー一覧の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [router, status, user]);

  const handleReset = async (loginId: string) => {
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'パスワード初期化に失敗しました');
      }
      setMessage(`${loginId} のパスワードを初期化しました（パスワード = login_id）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワード初期化に失敗しました');
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">ユーザー管理</h1>
          <p className="mb-4 text-sm text-gray-700">
            初期パスワードは「login_id」と同じ文字列です。パスワードが分からない場合は管理者に問い合わせてください。
          </p>

          {message && (
            <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
          )}
          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {isLoading ? (
            <div className="text-gray-600 text-sm">ユーザーを読み込み中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-800">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">login_id</th>
                    <th className="px-4 py-2 text-left font-medium">氏名</th>
                    <th className="px-4 py-2 text-left font-medium">役割</th>
                    <th className="px-4 py-2 text-left font-medium">拠点</th>
                    <th className="px-4 py-2 text-left font-medium">アクティブ</th>
                    <th className="px-4 py-2 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{user.login_id}</td>
                      <td className="px-4 py-2">{user.name}</td>
                      <td className="px-4 py-2">{user.role}</td>
                      <td className="px-4 py-2">{user.area}</td>
                      <td className="px-4 py-2">{user.active ? 'TRUE' : 'FALSE'}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleReset(user.login_id)}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          パスワード初期化
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
