'use client';

import { useState } from 'react';
import { usePublicQuote, useAcceptQuote, useRejectQuote } from '@/lib/hooks/usePublicQuote';
import { SignatureForm } from '@/components/ui/SignatureForm';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import type { QuoteStatus } from '@/lib/types';

const ACTIONABLE_STATUSES: QuoteStatus[] = ['SENT', 'VIEWED'];

interface Props {
  params: { publicId: string };
}

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PublicQuotePage({ params }: Props) {
  const { publicId } = params;
  const { data: quote, isLoading, isError } = usePublicQuote(publicId);
  const { mutateAsync: accept, isPending: isAccepting } = useAcceptQuote(publicId);
  const { mutateAsync: reject, isPending: isRejecting } = useRejectQuote(publicId);

  const [signed, setSigned] = useState(false);
  const [actionDone, setActionDone] = useState(false);

  // Normalize branding — may be absent on quotes created before Stage 3
  const branding = {
    logoUrl: quote?.branding?.logoUrl ?? null,
    primaryColor: quote?.branding?.primaryColor ?? '#2563eb',
    accentColor: quote?.branding?.accentColor ?? '#1d4ed8',
    footerText: quote?.branding?.footerText ?? null,
    companyName: quote?.branding?.companyName ?? null,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-400">Cargando cotización...</p>
        </div>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-4xl">🔍</p>
          <p className="text-gray-700 font-medium">Cotización no encontrada</p>
          <p className="text-sm text-gray-400">El enlace puede haber expirado o ser incorrecto.</p>
        </div>
      </div>
    );
  }

  const isActionable = ACTIONABLE_STATUSES.includes(quote.status) && !signed && !actionDone;
  const hasDiscount = quote.items.some(i => i.discount > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName ?? quote.issuer.company ?? 'Logo'}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: branding.primaryColor }}
              >
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">
              {branding.companyName ?? quote.issuer.company ?? 'Cotización'}
            </span>
          </div>
          <StatusBadge status={quote.status} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

        {/* Document header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div
            className="px-8 py-6"
            style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.accentColor})` }}
          >
            <h1 className="text-2xl font-bold text-white">{quote.title}</h1>
            {quote.validUntil && (
              <p className="mt-1 text-blue-100 text-sm">
                Válida hasta el {fmtDate(quote.validUntil)}
              </p>
            )}
          </div>

          <div className="px-8 py-6 grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Emitida por</p>
              <p className="font-semibold text-gray-900">{quote.issuer.name}</p>
              {quote.issuer.company && <p className="text-gray-500">{quote.issuer.company}</p>}
            </div>
            {quote.client && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Para</p>
                <p className="font-semibold text-gray-900">{quote.client.name}</p>
                {quote.client.company && <p className="text-gray-500">{quote.client.company}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        {quote.items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Descripción</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Cant.</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Precio unit.</th>
                  {hasDiscount && (
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Desc.</th>
                  )}
                  <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-gray-600 tabular-nums">{fmt(item.unitPrice, quote.currency)}</td>
                    {hasDiscount && (
                      <td className="px-4 py-4 text-right tabular-nums">
                        {item.discount > 0
                          ? <span className="text-green-600 font-medium">-{item.discount}%</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 tabular-nums">
                      {fmt(item.total, quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
              <div className="ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(quote.subtotal, quote.currency)}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento</span>
                    <span className="tabular-nums">-{fmt(quote.discount, quote.currency)}</span>
                  </div>
                )}
                {quote.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>IVA ({quote.taxRate}%)</span>
                    <span className="tabular-nums">{fmt(quote.taxAmount, quote.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                  <span className="font-bold text-gray-900 text-base">Total</span>
                  <span className="font-bold text-blue-600 text-xl tabular-nums">{fmt(quote.total, quote.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {quote.notes && (
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notas</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Términos y condiciones</p>
                <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{quote.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Signed confirmation */}
        {signed && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-5 flex items-start gap-4">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Cotización firmada y aceptada</p>
              <p className="text-sm text-green-600 mt-0.5">El emisor ha sido notificado. Guarda este enlace como comprobante.</p>
            </div>
          </div>
        )}

        {/* Action panel */}
        {isActionable && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Responder cotización</p>
              <p className="text-sm text-gray-400 mt-0.5">Acepta o rechaza esta propuesta. Puedes agregar tu firma abajo.</p>
            </div>
            <div className="px-6 py-5 space-y-6">
              <div className="flex gap-3">
                <Button
                  size="lg"
                  onClick={async () => { await accept(); setActionDone(true); }}
                  disabled={isAccepting || isRejecting}
                  loading={isAccepting}
                >
                  Aceptar cotización
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={async () => { await reject(); setActionDone(true); }}
                  disabled={isAccepting || isRejecting}
                  loading={isRejecting}
                >
                  Rechazar
                </Button>
              </div>
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Firma digital (opcional)</p>
                <SignatureForm publicId={publicId} onSuccess={() => setSigned(true)} />
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          Cotización #{publicId}
        </p>
        {branding.footerText && (
          <p className="text-center text-xs text-gray-400 pb-2">
            {branding.footerText}
          </p>
        )}
      </div>
    </div>
  );
}
