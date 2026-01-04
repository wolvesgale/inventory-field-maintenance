/**
 * /dashboard ページ
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { Navigation } from '@/components/Navigation';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTransactions } from '@/lib/sheets';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const userRole = (session.user as any)?.role || 'worker';
  const userName = session.user?.name || 'ユーザー';
  const isManager = userRole === 'manager';

  let pendingCount = 0;
  if (isManager) {
    const allTransactions = await getTransactions();
    pendingCount = allTransactions.filter((tx) => tx.status === 'pending').length;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">ようこそ</h1>
          <p className="text-lg text-gray-600">
            {userName}さん（{userRole === 'worker' ? '現場担当' : userRole === 'manager' ? 'マネージャー' : '管理者'}）
          </p>
        </div>

        {isManager && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-6 py-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">お知らせ</h2>
            {pendingCount > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-800">
                  未承認の申請が <span className="font-bold">{pendingCount} 件</span> あります。
                </p>
                <Link
                  href="/approve"
                  className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  承認画面へ
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-500">未承認の申請はありません。</p>
            )}
          </section>
        )}

        {/* Worker専用コンテンツ */}
        {(userRole === 'worker' || userRole === 'manager' || userRole === 'admin') && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">入出庫登録</h2>
            <p className="text-gray-600 mb-4">
              新しい入出庫を登録したいですか？
            </p>
            <a
              href="/transactions/new"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              新規登録
            </a>
          </div>
        )}

        {/* Manager/Admin専用コンテンツ */}
        {(userRole === 'manager' || userRole === 'admin') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* 承認待ち */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">承認待ち取引</h2>
                <p className="text-gray-600 mb-4">
                  マネージャー承認待ちの取引を確認・承認します。
                </p>
                <a
                  href="/approve"
                  className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
                >
                  承認画面へ
                </a>
              </div>

              {/* 在庫台帳 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">在庫台帳</h2>
                <p className="text-gray-600 mb-4">
                  現在の在庫状況を確認します。
                </p>
                <a
                  href="/stock"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  在庫確認
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 棚卸 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">棚卸</h2>
                <p className="text-gray-600 mb-4">
                  月末棚卸（実在庫カウント）を実施します。
                </p>
                <a
                  href="/physical-count"
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                >
                  棚卸実施
                </a>
              </div>

              {/* 月次レポート */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">月次レポート</h2>
                <p className="text-gray-600 mb-4">
                  月次締め処理と差異確認を行います。
                </p>
                <a
                  href="/reports/monthly"
                  className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
                >
                  レポート確認
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
