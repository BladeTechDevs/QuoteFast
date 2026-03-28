'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useClients } from '@/lib/hooks/useClients';
import { useTemplates } from '@/lib/hooks/useTemplates';
import {
  useCreateQuote,
  useUpdateQuote,
  useCreateQuoteItem,
  useUpdateQuoteItem,
  useDeleteQuoteItem,
  useSendQuote,
} from '@/lib/hooks/useQuoteDetail';
import { apiClient } from '@/lib/api';
import type { QuoteDetail, QuoteItem } from '@/lib/types';

// ── Calculation ──────────────────────────────────────────────────────────────
function calcItemTotal(item: { quantity: number; unitPrice: number; discount: number; taxRate: number }) {
  const sub = item.quantity * item.unitPrice;
  const net = sub - item.discount;
  return net + net * (item.taxRate / 100);
}

function calcTotals(
  items: Array<{ quantity: number; unitPrice: number; discount: number; taxRate: number }>,
  taxRate: number,
  discount: number,
) {
  const subtotal = items.reduce((s, i) => s + calcItemTotal(i), 0);
  const taxAmount = subtotal * (taxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount - discount };
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n);
}

// ── Local item state ─────────────────────────────────────────────────────────
interface LocalItem {
  id?: string;
  tempId: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  internalCost: string;
}

function newLocalItem(): LocalItem {
  return {
    tempId: crypto.randomUUID(),
    name: '', description: '', quantity: '1',
    unitPrice: '0', discount: '0', taxRate: '0', internalCost: '0',
  };
}

function toNumbers(item: LocalItem) {
  return {
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
    discount: parseFloat(item.discount) || 0,
    taxRate: parseFloat(item.taxRate) || 0,
    internalCost: parseFloat(item.internalCost) || 0,
  };
}

interface QuoteEditorProps { quote?: QuoteDetail; }

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];
const TERMINAL_STATES = new Set(['ACCEPTED', 'REJECTED', 'EXPIRED']);

export function QuoteEditor({ quote }: QuoteEditorProps) {
  const router = useRouter();
  const isNew = !quote;
  const isReadOnly = quote ? TERMINAL_STATES.has(quote.status) : false;

  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];
  const { data: templatesData } = useTemplates();
  const templates = templatesData ?? [];
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const [title, setTitle] = useState(quote?.title ?? '');
  const [clientId, setClientId] = useState(quote?.client?.id ?? '');
  const [currency, setCurrency] = useState(quote?.currency ?? 'USD');
  const [taxRate, setTaxRate] = useState(String(quote?.taxRate ?? '0'));
  const [discount, setDiscount] = useState(String(quote?.discount ?? '0'));
  const [validUntil, setValidUntil] = useState(quote?.validUntil ? quote.validUntil.slice(0, 10) : '');
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [terms, setTerms] = useState(quote?.terms ?? '');

  const [items, setItems] = useState<LocalItem[]>(() => {
    if (!quote?.items?.length) return [newLocalItem()];
    return quote.items.slice().sort((a, b) => a.order - b.order).map((it) => ({
      id: it.id, tempId: it.id, name: it.name,
      description: it.description ?? '',
      quantity: String(it.quantity), unitPrice: String(it.unitPrice),
      discount: String(it.discount ?? 0), taxRate: String(it.taxRate ?? 0),
      internalCost: String(it.internalCost ?? 0),
    }));
  });

  useEffect(() => {
    if (!quote?.items) return;
    setItems(quote.items.slice().sort((a, b) => a.order - b.order).map((it) => ({
      id: it.id, tempId: it.id, name: it.name,
      description: it.description ?? '',
      quantity: String(it.quantity), unitPrice: String(it.unitPrice),
      discount: String(it.discount ?? 0), taxRate: String(it.taxRate ?? 0),
      internalCost: String(it.internalCost ?? 0),
    })));
  }, [quote?.items]);

  const numericItems = items.map(toNumbers);
  const { subtotal, taxAmount, total } = calcTotals(numericItems, parseFloat(taxRate) || 0, parseFloat(discount) || 0);

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote(quote?.id ?? '');
  const createItem = useCreateQuoteItem(quote?.id ?? '');
  const updateItem = useUpdateQuoteItem(quote?.id ?? '');
  const deleteItem = useDeleteQuoteItem(quote?.id ?? '');
  const sendQuote = useSendQuote(quote?.id ?? '');

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const triggerAutoSave = useCallback(() => {
    if (isNew || isReadOnly || !quote?.id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateQuote.mutateAsync({
          title: title || undefined, clientId: clientId || null, currency,
          taxRate: parseFloat(taxRate) || 0, discount: parseFloat(discount) || 0,
          notes, terms, validUntil: validUntil || null,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { setSaveStatus('error'); }
    }, 5000);
  }, [isNew, isReadOnly, quote?.id, title, clientId, currency, taxRate, discount, notes, terms, validUntil, updateQuote]);

  useEffect(() => {
    triggerAutoSave();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, clientId, currency, taxRate, discount, notes, terms, validUntil]);

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    if (tpl.content.currency) setCurrency(tpl.content.currency);
    if (tpl.content.taxRate !== undefined) setTaxRate(String(tpl.content.taxRate));
    if (tpl.content.discount !== undefined) setDiscount(String(tpl.content.discount));
    if (tpl.content.notes) setNotes(tpl.content.notes);
    if (tpl.content.terms) setTerms(tpl.content.terms);
    setShowTemplateSelector(false);
  }

  const [titleError, setTitleError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) { setTitleError('El título es obligatorio'); return; }
    setIsCreating(true);
    try {
      const created = await createQuote.mutateAsync({
        title: title.trim(), clientId: clientId || undefined, currency,
        taxRate: parseFloat(taxRate) || 0, discount: parseFloat(discount) || 0,
        notes, terms, validUntil: validUntil || undefined,
      });
      const itemsToCreate = items.filter((it) => it.name.trim());
      for (let i = 0; i < itemsToCreate.length; i++) {
        const item = itemsToCreate[i];
        const nums = toNumbers(item);
        await apiClient.post(`/quotes/${created.id}/items`, {
          name: item.name.trim(), description: item.description || undefined,
          quantity: nums.quantity, unitPrice: nums.unitPrice, order: i,
        });
      }
      router.replace(`/quotes/${created.id}`);
    } catch { setIsCreating(false); }
  }

  function updateLocalItem(tempId: string, patch: Partial<LocalItem>) {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }

  async function handleItemBlur(item: LocalItem) {
    if (isNew || isReadOnly || !quote?.id) return;
    const nums = toNumbers(item);
    if (!item.name.trim()) return;
    if (item.id) {
      await updateItem.mutateAsync({
        itemId: item.id, name: item.name,
        description: item.description || undefined,
        quantity: nums.quantity, unitPrice: nums.unitPrice,
      });
    } else {
      const created = await createItem.mutateAsync({
        name: item.name, description: item.description || undefined,
        quantity: nums.quantity, unitPrice: nums.unitPrice, order: items.indexOf(item),
      });
      setItems((prev) => prev.map((it) => (it.tempId === item.tempId ? { ...it, id: created.id } : it)));
    }
  }

  async function handleDeleteItem(item: LocalItem) {
    if (isReadOnly) return;
    if (item.id && quote?.id) await deleteItem.mutateAsync(item.id);
    setItems((prev) => {
      const next = prev.filter((it) => it.tempId !== item.tempId);
      return next.length ? next : [newLocalItem()];
    });
  }

  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    if (isNew || !quote?.id) return;
    setSendError(''); setIsSending(true);
    try {
      const unsaved = items.filter((it) => !it.id && it.name.trim());
      for (const item of unsaved) {
        const nums = toNumbers(item);
        const created = await createItem.mutateAsync({
          name: item.name, description: item.description || undefined,
          quantity: nums.quantity, unitPrice: nums.unitPrice, order: items.indexOf(item),
        });
        setItems((prev) => prev.map((it) => (it.tempId === item.tempId ? { ...it, id: created.id } : it)));
      }
      if (!items.filter((it) => it.name.trim()).length) {
        setSendError('Agrega al menos un ítem antes de enviar.');
        setIsSending(false); return;
      }
      await sendQuote.mutateAsync();
      setSendSuccess(true);
    } catch (err: unknown) {
      setSendError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al enviar.');
    } finally { setIsSending(false); }
  }

  const selectClass = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400 w-full';

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left column: form fields ── */}
      <div className="w-72 shrink-0 space-y-4">

        {/* Nav + status */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/quotes')} className="text-sm text-gray-500 hover:text-gray-700">
            ← Cotizaciones
          </button>
          {quote && <StatusBadge status={quote.status} />}
        </div>

        {/* Auto-save */}
        {!isNew && (
          <p className="text-xs text-gray-400 -mt-2">
            {saveStatus === 'saving' && 'Guardando…'}
            {saveStatus === 'saved' && '✓ Guardado'}
            {saveStatus === 'error' && '⚠ Error al guardar'}
          </p>
        )}

        {/* Feedback */}
        {sendSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
            Cotización enviada. El cliente recibirá el link por email.
          </div>
        )}
        {sendError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {sendError}
          </div>
        )}

        {/* General info card */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Información general</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
              disabled={isReadOnly}
              placeholder="Ej. Propuesta de desarrollo web"
            />
            {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="client-select">Cliente</label>
            <select id="client-select" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={isReadOnly} className={selectClass}>
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="currency-select">Moneda</label>
            <select id="currency-select" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={isReadOnly} className={selectClass}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Input label="Válida hasta" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={isReadOnly} />

          <div className="grid grid-cols-2 gap-2">
            <Input label="Impuesto (%)" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={isReadOnly} />
            <Input label="Descuento" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={isReadOnly} />
          </div>
        </div>

        {/* Notes & Terms card */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas y términos</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">Notas</label>
            <textarea id="notes" rows={3} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadOnly} placeholder="Notas para el cliente…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="terms">Términos y condiciones</label>
            <textarea id="terms" rows={3} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400 resize-none" value={terms} onChange={(e) => setTerms(e.target.value)} disabled={isReadOnly} placeholder="Términos y condiciones…" />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isNew ? (
            <>
              {templates.length > 0 && (
                <div className="relative">
                  <button type="button" onClick={() => setShowTemplateSelector((v) => !v)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    📋 Usar plantilla
                  </button>
                  {showTemplateSelector && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Seleccionar plantilla</p>
                      <ul className="max-h-48 overflow-y-auto py-1">
                        {templates.map((tpl) => (
                          <li key={tpl.id}>
                            <button type="button" onClick={() => applyTemplate(tpl.id)} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                              <span className="font-medium">{tpl.name}</span>
                              {tpl.isDefault && <span className="ml-2 text-xs text-gray-400">Sistema</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <Button onClick={handleCreate} loading={isCreating} disabled={isCreating} className="w-full">
                Crear cotización
              </Button>
            </>
          ) : !isReadOnly ? (
            <Button
              onClick={handleSend}
              loading={isSending}
              disabled={isSending || items.filter((it) => it.name.trim()).length === 0}
              title={items.filter((it) => it.name.trim()).length === 0 ? 'Agrega al menos un ítem' : undefined}
              className="w-full"
            >
              Enviar cotización
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Right column: items table ── */}
      <div className="flex-1 min-w-0 space-y-0">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ítems</h2>
            {!isReadOnly && (
              <Button variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, newLocalItem()])}>
                + Agregar ítem
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '800px' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 w-[22%]">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[8%]">Cant.</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[11%]">P. Unitario</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[10%]">Descuento</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[8%]">Imp. %</th>
                  {!isReadOnly && <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[11%]">Costo interno</th>}
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-[10%]">Total</th>
                  {!isReadOnly && <th className="w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const nums = toNumbers(item);
                  const rowTotal = calcItemTotal(nums);
                  return (
                    <ItemRow
                      key={item.tempId}
                      item={item}
                      rowTotal={rowTotal}
                      currency={currency}
                      isReadOnly={isReadOnly}
                      onChange={(patch) => updateLocalItem(item.tempId, patch)}
                      onBlur={() => handleItemBlur(item)}
                      onDelete={() => handleDeleteItem(item)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
            <dl className="space-y-1.5 text-sm w-64">
              <div className="flex justify-between text-gray-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-gray-900">{fmt(subtotal, currency)}</dd>
              </div>
              {(parseFloat(taxRate) || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Impuesto ({taxRate}%)</dt>
                  <dd className="font-medium text-gray-900">{fmt(taxAmount, currency)}</dd>
                </div>
              )}
              {(parseFloat(discount) || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Descuento</dt>
                  <dd className="font-medium text-red-600">−{fmt(parseFloat(discount) || 0, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
                <dt>Total</dt>
                <dd>{fmt(total, currency)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── ItemRow ──────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: LocalItem;
  rowTotal: number;
  currency: string;
  isReadOnly: boolean;
  onChange: (patch: Partial<LocalItem>) => void;
  onBlur: () => void;
  onDelete: () => void;
}

function ItemRow({ item, rowTotal, currency, isReadOnly, onChange, onBlur, onDelete }: ItemRowProps) {
  const cell = 'px-4 py-3 text-sm text-gray-900';
  const inp = 'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-200 disabled:text-gray-400';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className={cell}>
        <input className={inp} value={item.name} onChange={(e) => onChange({ name: e.target.value })} onBlur={onBlur} disabled={isReadOnly} placeholder="Nombre del ítem" />
      </td>
      <td className={cell}>
        <input className={inp} value={item.description} onChange={(e) => onChange({ description: e.target.value })} onBlur={onBlur} disabled={isReadOnly} placeholder="Descripción (opcional)" />
      </td>
      <td className={cell}>
        <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} onBlur={onBlur} disabled={isReadOnly} />
      </td>
      <td className={cell}>
        <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => onChange({ unitPrice: e.target.value })} onBlur={onBlur} disabled={isReadOnly} />
      </td>
      <td className={cell}>
        <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.discount} onChange={(e) => onChange({ discount: e.target.value })} onBlur={onBlur} disabled={isReadOnly} />
      </td>
      <td className={cell}>
        <input className={`${inp} text-right`} type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={(e) => onChange({ taxRate: e.target.value })} onBlur={onBlur} disabled={isReadOnly} />
      </td>
      {!isReadOnly && (
        <td className={cell}>
          <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.internalCost} onChange={(e) => onChange({ internalCost: e.target.value })} onBlur={onBlur} disabled={isReadOnly} />
        </td>
      )}
      <td className={`${cell} text-right font-medium`}>{fmt(rowTotal, currency)}</td>
      {!isReadOnly && (
        <td className="px-2 py-2 text-center">
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none" title="Eliminar ítem">×</button>
        </td>
      )}
    </tr>
  );
}
