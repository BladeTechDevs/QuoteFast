'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useNotifications, useMarkRead, useMarkAllRead, useUnreadCount } from '@/lib/hooks/useNotifications';
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

function NotificationItem({
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
        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0',
        !n.read && 'bg-blue-50/60',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm truncate', !n.read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
            {n.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
        </div>
        {!n.read && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
        )}
      </div>
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: notifications = [] } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = unreadData?.count ?? 0;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleRead(id: string, quoteId: string | null) {
    markRead.mutate(id);
    if (quoteId) {
      setOpen(false);
      router.push(`/quotes/${quoteId}`);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                Sin notificaciones
              </p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleRead} />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2">
            <button
              onClick={() => { setOpen(false); router.push('/notifications'); }}
              className="w-full text-center text-xs text-blue-600 hover:text-blue-800 py-1"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
