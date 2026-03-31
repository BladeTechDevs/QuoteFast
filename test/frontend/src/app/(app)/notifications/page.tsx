'use client';

import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
} from '@/lib/hooks/useNotifications';
import type { Notification, NotificationType } from '@/lib/types';

const TYPE_ICON: Record<NotificationType, string> = {
  QUOTE_CREATED: '📝',
  QUOTE_SENT: '📤',
  QUOTE_VIEWED_BY_CLIENT: '👁️',
  QUOTE_ACCEPTED_BY_CLIENT: '✅',
  QUOTE_REJECTED_BY_CLIENT: '❌',
  QUOTE_SIGNED_BY_CLIENT: '✍️',
  QUOTE_EXPIRED: '⏰',
  QUOTE_PDF_READY: '📄',
  QUOTE_REMINDER_SENT: '🔔',
  PLAN_LIMIT_WARNING: '⚠️',
  PLAN_LIMIT_REACHED: '🚫',
  PLAN_UPGRADED: '🚀',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function NotificationRow({
  n,
  onRead,
}: {
  n: Notification;
  onRead: (id: string, quoteId: string | null) => void;
}) {
  return (
    <button
      onClick={() => onRead(n.id, n.quoteId)}
      className={clsx(
        'w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border transition-colors hover:bg-gray-50',
        n.read ? 'border-gray-100 bg-white' : 'border-blue-100 bg-blue-50/50',
      )}
    >
      <span className="text-2xl mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm', n.read ? 'text-gray-700' : 'font-semibold text-gray-900')}>
          {n.title}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && (
        <span className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleRead(id: string, quoteId: string | null) {
    markRead.mutate(id);
    if (quoteId) router.push(`/quotes/${quoteId}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-5xl mb-3">🔔</span>
          <p className="text-sm">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationRow key={n.id} n={n} onRead={handleRead} />
          ))}
        </div>
      )}
    </div>
  );
}
