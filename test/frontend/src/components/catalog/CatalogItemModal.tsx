'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCatalogItem, useUpdateCatalogItem } from '@/lib/hooks/useCatalog';
import type { CatalogItem } from '@/lib/types';
import type { CatalogItemFormData } from '@/lib/api/catalog';

interface CatalogItemModalProps {
  open: boolean;
  onClose: () => void;
  item?: CatalogItem | null;
}

const EMPTY: CatalogItemFormData = {
  name: '',
  description: '',
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
  internalCost: 0,
};

function getErrorMessage(error: unknown): string {
  if (!error) return '';
  const err = error as { response?: { data?: { message?: string | string[] } } };
  const msg = err.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function CatalogItemModal({ open, onClose, item }: CatalogItemModalProps) {
  const isEdit = !!item;
  const [form, setForm] = useState<CatalogItemFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof CatalogItemFormData, string>>>({});
  const [serverError, setServerError] = useState('');

  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem(item?.id ?? '');

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        description: item.description ?? '',
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discount: item.discount,
        internalCost: item.internalCost,
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setServerError('');
  }, [item, open]);

  function set<K extends keyof CatalogItemFormData>(field: K, value: CatalogItemFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setServerError('');
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'El nombre es obligatorio';
    else if (form.name.trim().length > 255) next.name = 'El nombre no puede superar 255 caracteres';
    if (form.unitPrice < 0) next.unitPrice = 'El precio unitario debe ser mayor o igual a 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CatalogItemFormData = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      unitPrice: Number(form.unitPrice),
      taxRate: Number(form.taxRate ?? 0),
      discount: Number(form.discount ?? 0),
      internalCost: Number(form.internalCost ?? 0),
    };

    try {
      if (isEdit) {
        await updateItem.mutateAsync(payload);
      } else {
        await createItem.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  }

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar ítem' : 'Nuevo ítem del catálogo'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="Ej. Consultoría por hora"
          autoFocus
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="catalog-description">
            Descripción
          </label>
          <textarea
            id="catalog-description"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descripción opcional del producto o servicio"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Precio unitario *"
            type="number"
            min={0}
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => set('unitPrice', parseFloat(e.target.value) || 0)}
            error={errors.unitPrice}
            placeholder="0.00"
          />
          <Input
            label="Impuesto (%)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.taxRate}
            onChange={(e) => set('taxRate', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Descuento"
            type="number"
            min={0}
            step="0.01"
            value={form.discount}
            onChange={(e) => set('discount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
          <Input
            label="Costo interno"
            type="number"
            min={0}
            step="0.01"
            value={form.internalCost}
            onChange={(e) => set('internalCost', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
        {serverError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear ítem'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
