import { clsx } from 'clsx';
import type { QuoteStatus } from '@/lib/types';

const statusConfig: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT:    { label: 'Borrador',  className: 'bg-gray-100 text-gray-700' },
  SENT:     { label: 'Enviada',   className: 'bg-blue-100 text-blue-700' },
  VIEWED:   { label: 'Vista',     className: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: 'Aceptada', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rechazada', className: 'bg-red-100 text-red-700' },
  EXPIRED:  { label: 'Expirada', className: 'bg-orange-100 text-orange-700' },
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const { label, className } = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}
