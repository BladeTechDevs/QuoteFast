'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { clsx } from 'clsx';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/quotes', label: 'Cotizaciones', icon: '📄' },
  { href: '/clients', label: 'Clientes', icon: '👥' },
  { href: '/catalog', label: 'Catálogo', icon: '🗂️' },
  { href: '/templates', label: 'Plantillas', icon: '📋' },
  { href: '/notifications', label: 'Notificaciones', icon: '🔔' },
  { href: '/settings', label: 'Configuración', icon: '⚙️' },
];

interface PlanUsage {
  plan: string;
  quotesThisMonth: number;
  quotesLimit: number | null;
  quotesRemaining: number | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: usage } = useQuery<PlanUsage>({
    queryKey: ['plan-usage'],
    queryFn: async () => {
      const { data } = await apiClient.get<PlanUsage>('/auth/usage');
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const showUsageWarning =
    usage?.quotesLimit !== null &&
    usage?.quotesLimit !== undefined &&
    usage.quotesRemaining !== null &&
    usage.quotesRemaining <= 1;

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">QuoteFast</span>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Plan usage widget */}
      {usage && usage.quotesLimit !== null && (
        <div className={clsx(
          'mx-3 mb-3 rounded-lg px-3 py-2.5 text-xs',
          showUsageWarning ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className={showUsageWarning ? 'text-red-700 font-medium' : 'text-gray-500'}>
              Cotizaciones
            </span>
            <span className={`font-semibold ${showUsageWarning ? 'text-red-700' : 'text-gray-700'}`}>
              {usage.quotesThisMonth}/{usage.quotesLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${showUsageWarning ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (usage.quotesThisMonth / usage.quotesLimit) * 100)}%` }}
            />
          </div>
          {usage.quotesRemaining === 0 && (
            <p className="mt-1 text-red-600 font-medium">Límite alcanzado</p>
          )}
        </div>
      )}

      {/* User */}
      {user && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.name}
          </p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <button
            onClick={logout}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}
