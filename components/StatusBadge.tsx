/**
 * ステータスバッジコンポーネント
 */

import { TransactionStatus } from '@/types';

const statusConfig: Record<TransactionStatus, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'bg-gray-200 text-gray-800' },
  pending: { label: '承認待ち', color: 'bg-orange-200 text-orange-800' },
  approved: { label: '承認済み', color: 'bg-green-200 text-green-800' },
  locked: { label: '締め済み（編集不可）', color: 'bg-gray-400 text-white' },
};

export interface StatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`px-2 py-1 rounded text-sm font-medium ${config.color} ${className}`}>
      {config.label}
    </span>
  );
}

// 新規品目バッジ
export function NewItemBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`px-2 py-1 rounded text-sm font-bold bg-red-200 text-red-800 ${className}`}>
      NEW
    </span>
  );
}
