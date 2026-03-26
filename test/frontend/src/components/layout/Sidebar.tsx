'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { clsx } from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/quotes', label: 'Cotizaciones', icon: '📄' },
  { href: '/clients', label: 'Clientes', icon: '👥' },
  { href: '/templates', label: 'Plantillas', icon: '📋' },
  { href: '/settings', label: 'Configuración', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">QuoteFast</span>
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
