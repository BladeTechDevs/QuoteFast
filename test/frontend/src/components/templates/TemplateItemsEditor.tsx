'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CatalogSearch } from '@/components/catalog/CatalogSearch';
import type { TemplateItemFormData } from '@/lib/api/quote-templates';

interface TemplateItemsEditorProps {
  items: TemplateItemFormData[];
  onChange: (items: TemplateItemFormData[]) => void;
  readOnly?: boolean;
}

function emptyItem(order: number): TemplateItemFormData {
  return { name: '', description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, internalCost: 0, order };
}

export function TemplateItemsEditor({ items, onChange, readOnly = false }: TemplateItemsEditorProps) {
  const [errors, setErrors] = useState<Record<number, Partial<Record<keyof TemplateItemFormData, string>>>>({});

  function addItem() {
    onChange([...items, emptyItem(items.length)]);
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index).map((it, i) => ({ ...it, order: i }));
    onChange(next);
    setErrors((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx !== index) next[idx > index ? idx - 1 : idx] = v;
      });
      return next;
    });
  }

  function updateItem(index: number, patch: Partial<TemplateItemFormData>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setErrors((prev) => ({ ...prev, [index]: { ...prev[index], ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) } }));
  }

  if (readOnly) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ítems de la plantilla</h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Sin ítems predefinidos.</p>
        ) : (
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripción</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Cant.</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">P. Unitario</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Imp. %</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Descuento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{item.name}</td>
                    <td className="px-3 py-2 text-gray-500">{item.description || '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.taxRate ?? 0}%</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.discount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Ítems de la plantilla</h3>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <CatalogSearch
              onSelect={(fields) => {
                onChange([...items, {
                  name: fields.name,
                  description: fields.description,
                  quantity: 1,
                  unitPrice: fields.unitPrice,
                  discount: fields.discount,
                  taxRate: fields.taxRate,
                  internalCost: fields.internalCost,
                  order: items.length,
                }]);
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addItem} className="shrink-0">
            + Agregar manual
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Sin ítems. Agrega uno con el botón de arriba.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500">Ítem {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  aria-label={`Eliminar ítem ${index + 1}`}
                >
                  Eliminar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Nombre *"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  error={errors[index]?.name}
                  placeholder="Ej. Consultoría"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <input
                    type="text"
                    value={item.description ?? ''}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Descripción opcional"
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  label="Cantidad"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantity ?? 1}
                  onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) >= 0 ? parseFloat(e.target.value) : 0 })}
                />
                <Input
                  label="P. Unitario *"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) >= 0 ? parseFloat(e.target.value) : 0 })}
                  error={errors[index]?.unitPrice}
                />
                <Input
                  label="Imp. (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={item.taxRate ?? 0}
                  onChange={(e) => updateItem(index, { taxRate: parseFloat(e.target.value) >= 0 ? parseFloat(e.target.value) : 0 })}
                />
                <Input
                  label="Descuento"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.discount ?? 0}
                  onChange={(e) => updateItem(index, { discount: parseFloat(e.target.value) >= 0 ? parseFloat(e.target.value) : 0 })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function validateTemplateItems(items: TemplateItemFormData[]): Record<number, Partial<Record<keyof TemplateItemFormData, string>>> {
  const errors: Record<number, Partial<Record<keyof TemplateItemFormData, string>>> = {};
  items.forEach((item, i) => {
    const itemErrors: Partial<Record<keyof TemplateItemFormData, string>> = {};
    if (!item.name.trim()) itemErrors.name = 'El nombre es obligatorio';
    else if (item.name.trim().length > 255) itemErrors.name = 'El nombre no puede superar 255 caracteres';
    if ((item.unitPrice ?? 0) < 0) itemErrors.unitPrice = 'El precio debe ser mayor o igual a 0';
    if (Object.keys(itemErrors).length > 0) errors[i] = itemErrors;
  });
  return errors;
}
