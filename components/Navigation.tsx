/**
 * ナビゲーションバーコンポーネント
 */

'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  roles: string[];
}

const navLinks: NavLink[] = [
  { href: '/dashboard', label: 'ホーム', roles: ['worker', 'manager', 'admin'] },
  { href: '/transactions/new', label: '入出庫登録', roles: ['worker', 'manager', 'admin'] },
  { href: '/transactions', label: '登録履歴', roles: ['worker', 'manager', 'admin'] },
  { href: '/approve', label: '承認', roles: ['manager', 'admin'] },
  { href: '/users', label: 'ユーザー管理', roles: ['manager', 'admin'] },
  { href: '/stock', label: '在庫台帳', roles: ['manager', 'admin'] },
  { href: '/physical-count', label: '棚卸', roles: ['manager', 'admin'] },
  { href: '/reports/monthly', label: '月次レポート', roles: ['manager', 'admin'] },
];

export function Navigation() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) {
    return null;
  }

  const userRole = session.user?.role || 'worker';
  const visibleLinks = navLinks.filter((link) => link.roles.includes(userRole));

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <nav className="bg-blue-600 text-white">
      <div className="max-w-full px-4 py-4">
        {/* ユーザー情報 */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold">在庫棚卸管理</h1>
          <div className="text-sm">
            <span className="mr-4">{session.user?.name}</span>
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-700 px-3 py-1 rounded text-white"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* ナビゲーションリンク */}
        <div className="flex flex-wrap gap-2">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded bg-blue-500 hover:bg-blue-700 text-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
