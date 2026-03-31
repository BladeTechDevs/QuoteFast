'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useListCatalogItems } from '@/lib/hooks/useCatalog';
import type { CatalogItem } from '@/lib/types';

export interface CatalogSearchSelection {
  name: string;
  description: string;
  unitPrice: number;
  taxRate: number;
  discount: number;
  internalCost: number;
}

interface CatalogSearchProps {
  onSelect: (fields: CatalogSearchSelection) => void;
  disabled?: boolean;
}

export function CatalogSearch({ onSelect, disabled }: CatalogSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useListCatalogItems(
    open ? { search: debouncedQuery || undefined, limit: 20 } : undefined,
  );

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  function handleSelect(item: CatalogItem) {
    onSelect({
      name: item.name,
      description: item.description ?? '',
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount,
      internalCost: item.internalCost,
    });
    setQuery('');
    setOpen(false);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleBlur() {
    // Delay so click on item fires first
    setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Buscar en catálogo</span>
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="Buscar producto o servicio…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
            autoComplete="off"
          />
          {open && (
            <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[280px] rounded-lg border border-gray-200 bg-white shadow-lg">
              {isLoading && (
                <p className="px-3 py-2 text-xs text-gray-400">Buscando…</p>
              )}

              {!isLoading && total === 0 && !debouncedQuery && (
                <div className="px-3 py-3 text-center">
                  <p className="text-sm text-gray-500">Tu catálogo está vacío.</p>
                  <Link
                    href="/catalog"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Agregar primer ítem →
                  </Link>
                </div>
              )}

              {!isLoading && total === 0 && debouncedQuery && (
                <p className="px-3 py-2 text-sm text-gray-500">
                  Sin resultados para &ldquo;{debouncedQuery}&rdquo;.
                </p>
              )}

              {!isLoading && items.length > 0 && (
                <ul className="max-h-52 overflow-y-auto py-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelect(item)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="ml-2 text-xs text-gray-400 truncate">{item.description}</span>
                        )}
                        <span className="float-right text-xs text-gray-500">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(item.unitPrice)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
