'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useListCatalogItems, useDeleteCatalogItem } from '@/lib/hooks/useCatalog';
import { CatalogItemModal } from '@/components/catalog/CatalogItemModal';
import { Button } from '@/components/ui/Button';
import type { CatalogItem } from '@/lib/types';

function formatPrice(value: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);
}

export default function CatalogPage() {
  const { data, isLoading, isError } = useListCatalogItems({ limit: 100 });
  const deleteItem = useDeleteCatalogItem();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const items = data?.data ?? [];

  function openCreate() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`¿Eliminar "${item.name}" del catálogo? Esta acción no se puede deshacer.`)) return;
    setDeletingId(item.id);
    try {
      await deleteItem.mutateAsync(item.id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `${data.total} ítem${data.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Button onClick={openCreate}>+ Nuevo ítem</Button>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-red-600">
            Error al cargar el catálogo. Intenta de nuevo.
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">Tu catálogo está vacío.</p>
            <button
              onClick={openCreate}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Agregar tu primer ítem
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Descripción</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Precio unitario</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Impuesto (%)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {item.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatPrice(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.taxRate}%</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === item.id}
                        onClick={() => handleDelete(item)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CatalogItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editingItem}
      />
    </div>
  );
}
