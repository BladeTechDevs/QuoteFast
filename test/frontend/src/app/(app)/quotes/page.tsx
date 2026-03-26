'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuotes } from '@/lib/hooks/useQuotes';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import type { QuoteStatus } from '@/lib/types';

const ALL_STATUSES: QuoteStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  VIEWED: 'Vista',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
};

const LIMIT = 10;

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(dateStr));
}

type SortField = 'createdAt' | 'updatedAt' | 'total';

function QuotesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialStatus = (searchParams.get('status') as QuoteStatus) || '';
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>(initialStatus);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, isError } = useQuotes({
    status: statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: LIMIT,
    sortBy,
    sortOrder,
  });

  const handleStatusChange = useCallback(
    (status: QuoteStatus | '') => {
      setStatusFilter(status);
      setPage(1);
      const params = new URLSearchParams(searchParams.toString());
      if (status) params.set('status', status);
      else params.delete('status');
      router.replace(`/quotes?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy],
  );

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `${data.total} cotización${data.total !== 1 ? 'es' : ''}` : ''}
          </p>
        </div>
        <Link href="/quotes/new">
          <Button>+ Nueva cotización</Button>
        </Link>
      </div>

      {/* Search + Status filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Buscar por título…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Buscar cotizaciones"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleStatusChange('')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isError ? (
          <div className="p-6 text-center text-sm text-red-600">
            Error al cargar las cotizaciones. Intenta de nuevo.
          </div>
        ) : !isLoading && (!data || data.data.length === 0) ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">
              No hay cotizaciones
              {statusFilter ? ` en estado "${STATUS_LABELS[statusFilter]}"` : ''}
              {debouncedSearch ? ` con "${debouncedSearch}"` : ''}.
            </p>
            <Link href="/quotes/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Crear cotización
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Título</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th
                  className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSort('total')}
                >
                  Total <SortIcon field="total" />
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSort('createdAt')}
                >
                  Creada <SortIcon field="createdAt" />
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSort('updatedAt')}
                >
                  Actualizada <SortIcon field="updatedAt" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : data!.data.map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {quote.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {quote.client?.name ?? <span className="italic text-gray-300">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={quote.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(quote.total, quote.currency)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(quote.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(quote.updatedAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <QuotesContent />
    </Suspense>
  );
}
