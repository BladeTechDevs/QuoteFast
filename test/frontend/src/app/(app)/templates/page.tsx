'use client';

import { useState } from 'react';
import { useQuoteTemplates, useDeleteQuoteTemplate } from '@/lib/hooks/useQuoteTemplates';
import { TemplateModal } from '@/components/templates/TemplateModal';
import { Button } from '@/components/ui/Button';
import type { QuoteTemplate } from '@/lib/types';

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(dateStr));
}

export default function TemplatesPage() {
  const { data: templates, isLoading, isError } = useQuoteTemplates();
  const deleteTemplate = useDeleteQuoteTemplate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingTemplate(null);
    setModalOpen(true);
  }

  function openEdit(template: QuoteTemplate) {
    setEditingTemplate(template);
    setModalOpen(true);
  }

  async function handleDelete(template: QuoteTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    setDeletingId(template.id);
    try {
      await deleteTemplate.mutateAsync(template.id);
    } finally {
      setDeletingId(null);
    }
  }

  const list = templates ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reutiliza configuraciones e ítems predefinidos al crear cotizaciones.
          </p>
        </div>
        <Button onClick={openCreate}>+ Nueva plantilla</Button>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-red-600">
            Error al cargar las plantillas. Intenta de nuevo.
          </div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">No hay plantillas disponibles.</p>
            <button onClick={openCreate} className="mt-2 text-sm text-blue-600 hover:underline">
              Crear tu primera plantilla
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Moneda</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Impuesto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ítems</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Creada</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{tpl.name}</td>
                  <td className="px-4 py-3 text-gray-500">{tpl.currency ?? 'USD'}</td>
                  <td className="px-4 py-3 text-gray-500">{tpl.taxRate ?? 0}%</td>
                  <td className="px-4 py-3 text-gray-500">
                    {tpl.items?.length > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        {tpl.items.length} ítem{tpl.items.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin ítems</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tpl.isDefault ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        Sistema
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Personal
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(tpl.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(tpl)}>
                        {tpl.isDefault ? 'Ver' : 'Editar'}
                      </Button>
                      {!tpl.isDefault && (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deletingId === tpl.id}
                          onClick={() => handleDelete(tpl)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        quoteTemplate={editingTemplate}
        useQuoteTemplateMode
      />
    </div>
  );
}
