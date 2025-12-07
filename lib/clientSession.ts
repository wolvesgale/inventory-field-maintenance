'use client';

import { useEffect, useState } from 'react';
import type { UserSession } from '@/types';

export function useSession() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/session');
      const data = await res.json();
      setUser(data.user ?? null);
      setError(null);
    } catch (err) {
      setError('セッションの取得に失敗しました');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  return {
    user,
    loading,
    error,
    status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
    refresh: fetchSession,
  } as const;
}
