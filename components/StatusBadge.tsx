// components/StatusBadge.tsx
'use client';

import clsx from 'clsx';
import { TransactionStatus } from '@/types';

const statusConfig: Record<TransactionStatus, { label: string; color: string }> = {
  draft: {
    label: '下書き',
    color: 'bg-gray-200 text-gray-800',
  },
  pending: {
    label: '承認待ち',
    color: 'bg-orange-200 text-orange-800',
  },
  approved: {
    label: '承認済み',
    color: 'bg-green-200 text-green-800',
  },
  returned: {
    // 差し戻し用の表示（新しく追加）
    label: '差し戻し',
    color: 'bg-red-200 text-red-800',
  },
  locked: {
    // もし今後使わないなら残しておいても問題なし（型にも含まれている想定）
    label: 'ロック',
    color: 'bg-gray-300 text-gray-700',
  },
};

type StatusBadgeProps = {
  status: TransactionStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status];

  if (!cfg) return null;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-1 text-xs font-semibold',
        cfg.color,
      )}
    >
      {cfg.label}
    </span>
  );
}

export default StatusBadge;
