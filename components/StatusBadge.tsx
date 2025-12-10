// components/StatusBadge.tsx
// This component is intentionally self-contained to avoid external type or utility dependencies.

// Local definition of transaction statuses used throughout the app.
export type TransactionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'locked';

const STATUS_CONFIG: Record<TransactionStatus, { label: string; className: string }> = {
  draft: {
    label: '下書き',
    className: 'bg-gray-200 text-gray-800',
  },
  pending: {
    label: '承認待ち',
    className: 'bg-orange-200 text-orange-800',
  },
  approved: {
    label: '承認済み',
    className: 'bg-green-200 text-green-800',
  },
  returned: {
    label: '差し戻し',
    className: 'bg-red-200 text-red-800',
  },
  locked: {
    label: 'ロック',
    className: 'bg-gray-300 text-gray-700',
  },
};

type StatusBadgeProps = {
  status: TransactionStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export default StatusBadge;
