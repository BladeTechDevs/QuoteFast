'use client';

import { useState } from 'react';
import {
  usePublicQuote,
  useAcceptQuote,
  useRejectQuote,
  useTrackPdfDownload,
} from '@/lib/hooks/usePublicQuote';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import type { QuoteStatus } from '@/lib/types';

interface Props {
  params: { publicId: string };
}

const TERMINAL_STATES = new Set<QuoteStatus>(['ACCEPTED', 'REJECTED', 'EXPIRED', 'SIGNED']);
const SIGNABLE_STATES = new Set<QuoteStatus>(['SENT', 'VIEWED']);

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(
    Number(n),
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PublicQuotePage({ params }: Props) {
  const { publicId } = params;

  // Fetching the quote also registers QUOTE_OPENED tracking on the backend
  const { data: quote, isLoading, isError } = usePublicQuote(publicId);

  const accept = useAcceptQuote(publicId);
  const reject = useRejectQuote(publicId);
  const trackPdf = useTrackPdfDownload();

  const [actionDone, setActionDone] = useState<'accepted' | 'rejected' | null>(null);
  const [actionError, setActionError] = useState('');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <div className="text-5xl">📄</div>
        <h1 className="text-xl font-semibold text-gray-800">Cotización no encontrada</h1>
        <p className="text-sm text-gray-500">
          El link puede haber expirado o ser incorrecto.
        </p>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATES.has(quote.status);
  const currentStatus = actionDone === 'accepted'
    ? 'ACCEPTED'
    : actionDone === 'rejected'
    ? 'REJECTED'
    : quote.status;

  async function handleAccept() {
    setActionError('');
    try {
      await accept.mutateAsync();
      setActionDone('accepted');
    } catch {
      setActionError('No se pudo aceptar la cotización. Intenta de nuevo.');
    }
  }

  async function handleReject() {
    setActionError('');
    try {
      await reject.mutateAsync();
      setActionDone('rejected');
    } catch {
      setActionError('No se pudo rechazar la cotización. Intenta de nuevo.');
    }
  }

  async function handlePdfDownload() {
    // Track the download event before opening the PDF
    trackPdf.mutate(publicId);
    window.open(quote!.pdfUrl!, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Issuer / branding */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-blue-600">QuoteFast</span>
              </div>
              <p className="text-sm text-gray-500">
                {quote.issuer.name}
                {quote.issuer.company ? ` · ${quote.issuer.company}` : ''}
              </p>
            </div>

            {/* Status + date */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <StatusBadge status={currentStatus as QuoteStatus} />
              {quote.validUntil && (
                <p className="text-xs text-gray-400">
                  Válida hasta: {fmtDate(quote.validUntil)}
                </p>
              )}
            </div>
          </div>

          <hr className="my-5 border-gray-100" />

          {/* Quote title + client */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                Cotización
              </p>
              <h1 className="text-lg font-semibold text-gray-900">{quote.title}</h1>
            </div>
            {quote.client && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                  Para
                </p>
                <p className="text-sm font-medium text-gray-900">{quote.client.name}</p>
                {quote.client.company && (
                  <p className="text-sm text-gray-500">{quote.client.company}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Ítems
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Descripción</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500 w-20">Cant.</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500 w-28">P. Unit.</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500 w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {Number(item.quantity)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {fmt(Number(item.unitPrice), quote.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {fmt(Number(item.total), quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 px-6 py-5 flex justify-end">
            <dl className="space-y-1.5 text-sm w-64">
              <div className="flex justify-between text-gray-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-gray-900">
                  {fmt(Number(quote.subtotal), quote.currency)}
                </dd>
              </div>
              {Number(quote.taxRate) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Impuesto ({Number(quote.taxRate)}%)</dt>
                  <dd className="font-medium text-gray-900">
                    {fmt(Number(quote.taxAmount), quote.currency)}
                  </dd>
                </div>
              )}
              {Number(quote.discount) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Descuento</dt>
                  <dd className="font-medium text-red-600">
                    −{fmt(Number(quote.discount), quote.currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                <dt>Total</dt>
                <dd>{fmt(Number(quote.total), quote.currency)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            {quote.notes && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  Notas
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  Términos y condiciones
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Action area */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          {/* Post-action confirmation */}
          {actionDone === 'accepted' && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center">
              ✓ Has aceptado esta cotización. El emisor ha sido notificado.
            </div>
          )}
          {actionDone === 'rejected' && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
              Has rechazado esta cotización. El emisor ha sido notificado.
            </div>
          )}

          {/* Error */}
          {actionError && (
            <p className="text-sm text-red-600 text-center mb-3">{actionError}</p>
          )}

          {/* Buttons — hidden when terminal or after action */}
          {!isTerminal && !actionDone && (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAccept}
                loading={accept.isPending}
                disabled={accept.isPending || reject.isPending}
              >
                Aceptar cotización
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={handleReject}
                loading={reject.isPending}
                disabled={accept.isPending || reject.isPending}
              >
                Rechazar
              </Button>
            </div>
          )}

          {/* PDF download — always shown if pdfUrl exists */}
          {quote.pdfUrl && (
            <div className={!isTerminal && !actionDone ? 'mt-4 text-center' : 'text-center'}>
              <button
                onClick={handlePdfDownload}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
              >
                <span>⬇</span> Descargar PDF
              </button>
            </div>
          )}

          {/* Terminal state message */}
          {isTerminal && !actionDone && (
            <p className="text-sm text-gray-500 text-center">
              Esta cotización ya no está disponible para acciones.
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Generado con QuoteFast
        </p>
      </div>
    </div>
  );
}
