'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  useCreateTemplate,
  useUpdateTemplate,
  type TemplateFormData,
} from '@/lib/hooks/useTemplates';
import {
  useCreateQuoteTemplate,
  useUpdateQuoteTemplate,
} from '@/lib/hooks/useQuoteTemplates';
import { TemplateItemsEditor, validateTemplateItems } from '@/components/templates/TemplateItemsEditor';
import type { Template, QuoteTemplate } from '@/lib/types';
import type { TemplateItemFormData } from '@/lib/api/quote-templates';

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  template?: Template | null;
  quoteTemplate?: QuoteTemplate | null;
  useQuoteTemplateMode?: boolean;
}

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

function getErrorMessage(error: unknown): string {
  if (!error) return '';
  const err = error as { response?: { data?: { message?: string | string[] } } };
  const msg = err.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function TemplateModal({ open, onClose, template, quoteTemplate, useQuoteTemplateMode = false }: TemplateModalProps) {
  const isQuoteMode = useQuoteTemplateMode || !!quoteTemplate;
  const isEdit = isQuoteMode ? !!quoteTemplate : !!template;
  const isReadOnly = isQuoteMode && (quoteTemplate?.isDefault ?? false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<TemplateItemFormData[]>([]);
  const [itemErrors, setItemErrors] = useState<Record<number, Partial<Record<keyof TemplateItemFormData, string>>>>({});
  const [serverError, setServerError] = useState('');

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate(template?.id ?? '');
  const createQuoteTemplate = useCreateQuoteTemplate();
  const updateQuoteTemplate = useUpdateQuoteTemplate(quoteTemplate?.id ?? '');

  useEffect(() => {
    if (!open) return;
    if (isQuoteMode && quoteTemplate) {
      setName(quoteTemplate.name);
      setCurrency(quoteTemplate.currency ?? 'USD');
      setTaxRate(String(quoteTemplate.taxRate ?? 0));
      setDiscount(String(quoteTemplate.discount ?? 0));
      setNotes(quoteTemplate.notes ?? '');
      setTerms(quoteTemplate.terms ?? '');
      setItems((quoteTemplate.items ?? []).map((it) => ({
        name: it.name, description: it.description ?? '',
        quantity: it.quantity, unitPrice: it.unitPrice,
        discount: it.discount, taxRate: it.taxRate,
        internalCost: it.internalCost, order: it.order,
      })));
    } else if (!isQuoteMode && template) {
      setName(template.name);
      setCurrency(template.content.currency ?? 'USD');
      setTaxRate(String(template.content.taxRate ?? 0));
      setDiscount(String(template.content.discount ?? 0));
      setNotes(template.content.notes ?? '');
      setTerms(template.content.terms ?? '');
      setItems([]);
    } else {
      setName(''); setCurrency('USD'); setTaxRate('0'); setDiscount('0');
      setNotes(''); setTerms(''); setItems([]);
    }
    setNameError(''); setItemErrors({}); setServerError('');
  }, [template, quoteTemplate, open, isQuoteMode]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('El nombre es obligatorio'); return; }

    if (isQuoteMode) {
      const errs = validateTemplateItems(items);
      if (Object.keys(errs).length > 0) { setItemErrors(errs); return; }
      const payload = {
        name: name.trim(), currency,
        taxRate: parseFloat(taxRate) || 0,
        discount: parseFloat(discount) || 0,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        items: items.map((it, i) => ({
          name: it.name,
          description: it.description || undefined,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          taxRate: Number(it.taxRate) || 0,
          internalCost: Number(it.internalCost) || 0,
          order: i,
        })),
      };
      try {
        if (isEdit) await updateQuoteTemplate.mutateAsync(payload);
        else await createQuoteTemplate.mutateAsync(payload);
        onClose();
      } catch (err) { setServerError(getErrorMessage(err)); }
    } else {
      const payload: TemplateFormData = {
        name: name.trim(),
        content: {
          currency, taxRate: parseFloat(taxRate) || 0,
          discount: parseFloat(discount) || 0,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
        },
      };
      try {
        if (isEdit) await updateTemplate.mutateAsync(payload);
        else await createTemplate.mutateAsync(payload);
        onClose();
      } catch { /* handled by mutation */ }
    }
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending ||
    createQuoteTemplate.isPending || updateQuoteTemplate.isPending;

  const panelTitle = isEdit
    ? isReadOnly ? 'Ver plantilla del sistema' : 'Editar plantilla'
    : 'Nueva plantilla';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="flex flex-col w-full max-w-3xl bg-white shadow-2xl h-full">

        {/* Header — fixed */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{panelTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Cerrar">×</button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Name */}
            <Input
              label="Nombre *"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              error={nameError}
              placeholder="Ej. Propuesta de servicios"
              autoFocus
              disabled={isReadOnly}
            />

            {/* Meta row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="tpl-currency">Moneda</label>
                <select
                  id="tpl-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={isReadOnly}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Input label="Impuesto (%)" type="number" min="0" max="100" step="0.01"
                value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={isReadOnly} />
              <Input label="Descuento" type="number" min="0" step="0.01"
                value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={isReadOnly} />
            </div>

            {/* Notes + Terms side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="tpl-notes">Notas predeterminadas</label>
                <textarea id="tpl-notes" rows={3} value={notes}
                  onChange={(e) => setNotes(e.target.value)} disabled={isReadOnly}
                  placeholder="Notas que se pre-poblarán en la cotización…"
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="tpl-terms">Términos predeterminados</label>
                <textarea id="tpl-terms" rows={3} value={terms}
                  onChange={(e) => setTerms(e.target.value)} disabled={isReadOnly}
                  placeholder="Términos y condiciones que se pre-poblarán…"
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Items section */}
            {isQuoteMode && (
              <div className="border-t border-gray-100 pt-5">
                <TemplateItemsEditor items={items} onChange={setItems} readOnly={isReadOnly} />
                {Object.keys(itemErrors).length > 0 && (
                  <p className="mt-2 text-sm text-red-600">Corrige los errores en los ítems antes de continuar.</p>
                )}
              </div>
            )}

            {serverError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
            )}
          </div>

          {/* Footer — fixed */}
          <div className="shrink-0 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 bg-white">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!isReadOnly && (
              <Button type="submit" loading={isPending}>
                {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
