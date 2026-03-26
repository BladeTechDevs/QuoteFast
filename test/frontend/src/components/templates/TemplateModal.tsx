'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  useCreateTemplate,
  useUpdateTemplate,
  type TemplateFormData,
} from '@/lib/hooks/useTemplates';
import type { Template } from '@/lib/types';

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  template?: Template | null;
}

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

const EMPTY: TemplateFormData = {
  name: '',
  content: { currency: 'USD', taxRate: 0, discount: 0, notes: '', terms: '' },
};

export function TemplateModal({ open, onClose, template }: TemplateModalProps) {
  const isEdit = !!template;
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(template?.id ?? '');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCurrency(template.content.currency ?? 'USD');
      setTaxRate(String(template.content.taxRate ?? 0));
      setDiscount(String(template.content.discount ?? 0));
      setNotes(template.content.notes ?? '');
      setTerms(template.content.terms ?? '');
    } else {
      setName('');
      setCurrency('USD');
      setTaxRate('0');
      setDiscount('0');
      setNotes('');
      setTerms('');
    }
    setNameError('');
  }, [template, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('El nombre es obligatorio');
      return;
    }

    const payload: TemplateFormData = {
      name: name.trim(),
      content: {
        currency,
        taxRate: parseFloat(taxRate) || 0,
        discount: parseFloat(discount) || 0,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
      },
    };

    try {
      if (isEdit) {
        await updateTemplate.mutateAsync(payload);
      } else {
        await createTemplate.mutateAsync(payload);
      }
      onClose();
    } catch {
      // handled by mutation
    }
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar plantilla' : 'Nueva plantilla'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(''); }}
          error={nameError}
          placeholder="Ej. Propuesta de servicios"
          autoFocus
        />

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="tpl-currency">
              Moneda
            </label>
            <select
              id="tpl-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Input
            label="Impuesto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
          <Input
            label="Descuento"
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="tpl-notes">
            Notas predeterminadas
          </label>
          <textarea
            id="tpl-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas que se pre-poblarán en la cotización…"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="tpl-terms">
            Términos predeterminados
          </label>
          <textarea
            id="tpl-terms"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Términos y condiciones que se pre-poblarán…"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
