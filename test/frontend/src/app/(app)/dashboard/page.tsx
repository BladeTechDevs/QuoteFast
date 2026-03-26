'use client';

import Link from 'next/link';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonRow';
import type { QuoteStatus } from '@/lib/types';

const STATUS_ORDER: QuoteStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Borradores',
  SENT: 'Enviadas',
  VIEWED: 'Vistas',
  ACCEPTED: 'Aceptadas',
  REJECTED: 'Rechazadas',
  EXPIRED: 'Expiradas',
};

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(dateStr));
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Error al cargar el dashboard. Intenta de nuevo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen de tu actividad en QuoteFast.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Valor del Pipeline</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCurrency(data.pipelineValue)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Cotizaciones enviadas y vistas</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Tasa de Conversión</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.conversionRate.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-gray-400">Aceptadas / Total enviadas</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Tasa de Apertura</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {(data as any).openRate?.toFixed(1) ?? '—'}%
          </p>
          <p className="mt-1 text-xs text-gray-400">Vistas / Total enviadas</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Días Promedio para Aceptar</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {(data as any).avgDaysToAccept != null
              ? `${(data as any).avgDaysToAccept}d`
              : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Desde envío hasta aceptación</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Cotizaciones por Estado</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={`/quotes?status=${status}`}
              className="flex flex-col items-center rounded-md border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl font-bold text-gray-900">
                {data.statusCounts[status] ?? 0}
              </span>
              <StatusBadge status={status} />
              <span className="mt-1 text-xs text-gray-400">{STATUS_LABELS[status]}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent quotes */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700">Cotizaciones Recientes</h2>
          <Link href="/quotes" className="text-xs text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>

        {data.recentQuotes.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No hay cotizaciones aún.{' '}
            <Link href="/quotes/new" className="text-blue-600 hover:underline">
              Crea tu primera cotización
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentQuotes.map((quote) => (
              <div key={quote.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{quote.title}</p>
                  <p className="text-xs text-gray-400">
                    {quote.client?.name ?? 'Sin cliente'} · {formatDate(quote.updatedAt)}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <StatusBadge status={quote.status} />
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrency(quote.total, quote.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
