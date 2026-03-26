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
import type { QuoteDetail, QuoteItem } from '@/lib/types';

// ── Totals calculation (mirrors backend logic) ──────────────────────────────
function calcTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  discount: number,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, total };
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n);
}

// ── Local item row state ─────────────────────────────────────────────────────
interface LocalItem {
  id?: string;       // undefined = not yet persisted
  tempId: string;    // stable key for React
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function newLocalItem(): LocalItem {
  return {
    tempId: crypto.randomUUID(),
    name: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
  };
}

function toNumbers(item: LocalItem) {
  return {
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  };
}

// ── Props ────────────────────────────────────────────────────────────────────
interface QuoteEditorProps {
  quote?: QuoteDetail;
}

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

const TERMINAL_STATES = new Set(['ACCEPTED', 'REJECTED', 'EXPIRED']);

export function QuoteEditor({ quote }: QuoteEditorProps) {
  const router = useRouter();
  const isNew = !quote;
  const isReadOnly = quote ? TERMINAL_STATES.has(quote.status) : false;

  // ── Clients ────────────────────────────────────────────────────────────────
  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];

  // ── Templates ─────────────────────────────────────────────────────────────
  const { data: templatesData } = useTemplates();
  const templates = templatesData ?? [];
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // ── Quote field state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState(quote?.title ?? '');
  const [clientId, setClientId] = useState(quote?.client?.id ?? '');
  const [currency, setCurrency] = useState(quote?.currency ?? 'USD');
  const [taxRate, setTaxRate] = useState(String(quote?.taxRate ?? '0'));
  const [discount, setDiscount] = useState(String(quote?.discount ?? '0'));
  const [validUntil, setValidUntil] = useState(
    quote?.validUntil ? quote.validUntil.slice(0, 10) : '',
  );
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [terms, setTerms] = useState(quote?.terms ?? '');

  // ── Items state ────────────────────────────────────────────────────────────
  const [items, setItems] = useState<LocalItem[]>(() => {
    if (!quote?.items?.length) return [newLocalItem()];
    return quote.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        id: it.id,
        tempId: it.id,
        name: it.name,
        description: it.description ?? '',
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
      }));
  });

  // ── Sync items when quote prop changes (after server save) ─────────────────
  useEffect(() => {
    if (!quote?.items) return;
    setItems(
      quote.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((it) => ({
          id: it.id,
          tempId: it.id,
          name: it.name,
          description: it.description ?? '',
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        })),
    );
  }, [quote?.items]);

  // ── Real-time totals ───────────────────────────────────────────────────────
  const numericItems = items.map(toNumbers);
  const { subtotal, taxAmount, total } = calcTotals(
    numericItems,
    parseFloat(taxRate) || 0,
    parseFloat(discount) || 0,
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote(quote?.id ?? '');
  const createItem = useCreateQuoteItem(quote?.id ?? '');
  const updateItem = useUpdateQuoteItem(quote?.id ?? '');
  const deleteItem = useDeleteQuoteItem(quote?.id ?? '');
  const sendQuote = useSendQuote(quote?.id ?? '');

  // ── Auto-save (debounced, 5 s) ─────────────────────────────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const triggerAutoSave = useCallback(() => {
    if (isNew || isReadOnly || !quote?.id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateQuote.mutateAsync({
          title: title || undefined,
          clientId: clientId || null,
          currency,
          taxRate: parseFloat(taxRate) || 0,
          discount: parseFloat(discount) || 0,
          notes,
          terms,
          validUntil: validUntil || null,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 5000);
  }, [isNew, isReadOnly, quote?.id, title, clientId, currency, taxRate, discount, notes, terms, validUntil, updateQuote]);

  // Trigger auto-save whenever any field changes
  useEffect(() => {
    triggerAutoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, clientId, currency, taxRate, discount, notes, terms, validUntil]);

  // ── Apply template ─────────────────────────────────────────────────────────
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

  // ── Create new quote ───────────────────────────────────────────────────────
  const [titleError, setTitleError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      setTitleError('El título es obligatorio');
      return;
    }
    setIsCreating(true);
    try {
      const created = await createQuote.mutateAsync({
        title: title.trim(),
        clientId: clientId || undefined,
        currency,
        taxRate: parseFloat(taxRate) || 0,
        discount: parseFloat(discount) || 0,
        notes,
        terms,
        validUntil: validUntil || undefined,
      });
      router.replace(`/quotes/${created.id}`);
    } catch {
      setIsCreating(false);
    }
  }

  // ── Item handlers ──────────────────────────────────────────────────────────
  function updateLocalItem(tempId: string, patch: Partial<LocalItem>) {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  }

  async function handleItemBlur(item: LocalItem) {
    if (isNew || isReadOnly || !quote?.id) return;
    const nums = toNumbers(item);
    if (!item.name.trim()) return;

    if (item.id) {
      // Update existing
      await updateItem.mutateAsync({
        itemId: item.id,
        name: item.name,
        description: item.description || undefined,
        quantity: nums.quantity,
        unitPrice: nums.unitPrice,
      });
    } else {
      // Create new
      const created = await createItem.mutateAsync({
        name: item.name,
        description: item.description || undefined,
        quantity: nums.quantity,
        unitPrice: nums.unitPrice,
        order: items.indexOf(item),
      });
      setItems((prev) =>
        prev.map((it) => (it.tempId === item.tempId ? { ...it, id: created.id } : it)),
      );
    }
  }

  async function handleDeleteItem(item: LocalItem) {
    if (isReadOnly) return;
    if (item.id && quote?.id) {
      await deleteItem.mutateAsync(item.id);
    }
    setItems((prev) => {
      const next = prev.filter((it) => it.tempId !== item.tempId);
      return next.length ? next : [newLocalItem()];
    });
  }

  function addRow() {
    setItems((prev) => [...prev, newLocalItem()]);
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    if (isNew || !quote?.id) return;
    
    setSendError('');
    setIsSending(true);
    
    try {
      // First, save any unsaved items
      const unsavedItems = items.filter((it) => !it.id && it.name.trim());
      
      for (const item of unsavedItems) {
        const nums = toNumbers(item);
        const created = await createItem.mutateAsync({
          name: item.name,
          description: item.description || undefined,
          quantity: nums.quantity,
          unitPrice: nums.unitPrice,
          order: items.indexOf(item),
        });
        // Update local state with the new ID
        setItems((prev) =>
          prev.map((it) => (it.tempId === item.tempId ? { ...it, id: created.id } : it)),
        );
      }
      
      // Check if we have at least one item after saving
      const allItems = items.filter((it) => it.name.trim());
      if (!allItems.length) {
        setSendError('Agrega al menos un ítem antes de enviar.');
        setIsSending(false);
        return;
      }
      
      // Now send the quote
      await sendQuote.mutateAsync();
      setSendSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al enviar la cotización.';
      setSendError(msg);
    } finally {
      setIsSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const persistedItemCount = items.filter((it) => it.id).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/quotes')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Cotizaciones
          </button>
          {quote && <StatusBadge status={quote.status} />}
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save indicator */}
          {!isNew && (
            <span className="text-xs text-gray-400">
              {saveStatus === 'saving' && 'Guardando…'}
              {saveStatus === 'saved' && '✓ Guardado'}
              {saveStatus === 'error' && '⚠ Error al guardar'}
            </span>
          )}
          {isNew ? (
            <>
              {/* Template selector */}
              {templates.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateSelector((v) => !v)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    📋 Usar plantilla
                  </button>
                  {showTemplateSelector && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        Seleccionar plantilla
                      </p>
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {templates.map((tpl) => (
                          <li key={tpl.id}>
                            <button
                              type="button"
                              onClick={() => applyTemplate(tpl.id)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <span className="font-medium">{tpl.name}</span>
                              {tpl.isDefault && (
                                <span className="ml-2 text-xs text-gray-400">Sistema</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <Button onClick={handleCreate} loading={isCreating} disabled={isCreating}>
                Crear cotización
              </Button>
            </>
          ) : (
            !isReadOnly && (
              <Button
                onClick={handleSend}
                loading={isSending}
                disabled={isSending || items.filter((it) => it.name.trim()).length === 0}
                title={items.filter((it) => it.name.trim()).length === 0 ? 'Agrega al menos un ítem' : undefined}
              >
                Enviar cotización
              </Button>
            )
          )}
        </div>
      </div>

      {/* Send feedback */}
      {sendSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Cotización enviada correctamente. El cliente recibirá un email con el link.
        </div>
      )}
      {sendError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {sendError}
        </div>
      )}

      {/* Quote fields */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Información general
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Título *"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
              error={titleError}
              disabled={isReadOnly}
              placeholder="Ej. Propuesta de desarrollo web"
            />
          </div>

          {/* Client select */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="client-select">
              Cliente
            </label>
            <select
              id="client-select"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isReadOnly}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="currency-select">
              Moneda
            </label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isReadOnly}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <Input
            label="Válida hasta"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            disabled={isReadOnly}
          />

          <Input
            label="Impuesto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            disabled={isReadOnly}
          />

          <Input
            label="Descuento"
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            disabled={isReadOnly}
          />

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="notes">
              Notas
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isReadOnly}
              placeholder="Notas adicionales para el cliente…"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="terms">
              Términos y condiciones
            </label>
            <textarea
              id="terms"
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              disabled={isReadOnly}
              placeholder="Términos y condiciones…"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ítems</h2>
          {!isReadOnly && (
            <Button variant="secondary" size="sm" onClick={addRow}>
              + Agregar ítem
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600 w-1/3">Nombre</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Descripción</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600 w-24">Cant.</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600 w-28">P. Unitario</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600 w-28">Total</th>
                {!isReadOnly && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => {
                const { quantity, unitPrice } = toNumbers(item);
                const rowTotal = quantity * unitPrice;
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
        <TotalsPanel
          subtotal={subtotal}
          taxRate={parseFloat(taxRate) || 0}
          taxAmount={taxAmount}
          discount={parseFloat(discount) || 0}
          total={total}
          currency={currency}
        />
      </div>

      {/* Send button (bottom) */}
      {!isNew && !isReadOnly && (
        <div className="flex justify-end gap-3">
          {sendError && (
            <span className="text-sm text-red-600 self-center">{sendError}</span>
          )}
          <Button
            onClick={handleSend}
            loading={isSending}
            disabled={isSending || items.filter((it) => it.name.trim()).length === 0}
            title={items.filter((it) => it.name.trim()).length === 0 ? 'Agrega al menos un ítem' : undefined}
          >
            Enviar cotización
          </Button>
        </div>
      )}
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
  const cellClass =
    'px-4 py-2 text-sm text-gray-900';
  const inputClass =
    'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-200 disabled:text-gray-400';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className={cellClass}>
        <input
          className={inputClass}
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={onBlur}
          disabled={isReadOnly}
          placeholder="Nombre del ítem"
        />
      </td>
      <td className={cellClass}>
        <input
          className={inputClass}
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          onBlur={onBlur}
          disabled={isReadOnly}
          placeholder="Descripción (opcional)"
        />
      </td>
      <td className={`${cellClass} text-right`}>
        <input
          className={`${inputClass} text-right`}
          type="number"
          min="0"
          step="0.01"
          value={item.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          onBlur={onBlur}
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellClass} text-right`}>
        <input
          className={`${inputClass} text-right`}
          type="number"
          min="0"
          step="0.01"
          value={item.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value })}
          onBlur={onBlur}
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellClass} text-right font-medium`}>
        {fmt(rowTotal, currency)}
      </td>
      {!isReadOnly && (
        <td className="px-2 py-2 text-center">
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
            title="Eliminar ítem"
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
}

// ── TotalsPanel ──────────────────────────────────────────────────────────────
interface TotalsPanelProps {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
}

function TotalsPanel({ subtotal, taxRate, taxAmount, discount, total, currency }: TotalsPanelProps) {
  return (
    <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
      <dl className="space-y-1 text-sm w-64">
        <div className="flex justify-between text-gray-600">
          <dt>Subtotal</dt>
          <dd className="font-medium text-gray-900">{fmt(subtotal, currency)}</dd>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-gray-600">
            <dt>Impuesto ({taxRate}%)</dt>
            <dd className="font-medium text-gray-900">{fmt(taxAmount, currency)}</dd>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-gray-600">
            <dt>Descuento</dt>
            <dd className="font-medium text-red-600">−{fmt(discount, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
          <dt>Total</dt>
          <dd>{fmt(total, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
