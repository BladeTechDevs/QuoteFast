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

export default function PublicQuotePage({ params }: Props) {
  const { publicId } = params;
  const { data: quote, isLoading, isError } = usePublicQuote(publicId);
  const { mutateAsync: accept, isPending: isAccepting } = useAcceptQuote(publicId);
  const { mutateAsync: reject, isPending: isRejecting } = useRejectQuote(publicId);

  const [signed, setSigned] = useState(false);
  const [actionDone, setActionDone] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando cotización...</div>;
  if (isError || !quote) return <div className="p-8 text-center text-red-500">No se pudo cargar la cotización.</div>;

  const isActionable = ACTIONABLE_STATUSES.includes(quote.status) && !signed && !actionDone;

  const handleAccept = async () => {
    await accept();
    setActionDone(true);
  };

  const handleReject = async () => {
    await reject();
    setActionDone(true);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{quote.title}</h1>
        <StatusBadge status={quote.status} />
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p>Emisor: {quote.issuer.name}{quote.issuer.company ? ` — ${quote.issuer.company}` : ''}</p>
        {quote.client && (
          <p>Cliente: {quote.client.name}{quote.client.company ? ` — ${quote.client.company}` : ''}</p>
        )}
      </div>

      {quote.items.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Descripción</th>
              <th className="py-2 pr-4 text-right">Cant.</th>
              <th className="py-2 pr-4 text-right">Precio</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2 pr-4">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-gray-400">{item.description}</p>}
                </td>
                <td className="py-2 pr-4 text-right">{item.quantity}</td>
                <td className="py-2 pr-4 text-right">{Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-right">{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>Subtotal: {quote.currency} {Number(quote.subtotal).toFixed(2)}</p>
        {quote.discount > 0 && <p>Descuento: -{quote.currency} {Number(quote.discount).toFixed(2)}</p>}
        {quote.taxAmount > 0 && <p>Impuesto ({quote.taxRate}%): {quote.currency} {Number(quote.taxAmount).toFixed(2)}</p>}
        <p className="text-base font-semibold">Total: {quote.currency} {Number(quote.total).toFixed(2)}</p>
      </div>

      {quote.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>}
      {quote.terms && <p className="text-xs text-gray-400 whitespace-pre-wrap">{quote.terms}</p>}

      {signed && (
        <p className="text-green-700 font-medium">
          ✓ Has firmado y aceptado esta cotización. El emisor ha sido notificado.
        </p>
      )}

      {isActionable && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={handleAccept} disabled={isAccepting || isRejecting}>
              Aceptar cotización
            </Button>
            <Button variant="secondary" onClick={handleReject} disabled={isAccepting || isRejecting}>
              Rechazar
            </Button>
          </div>
          <SignatureForm publicId={publicId} onSuccess={() => setSigned(true)} />
        </div>
      )}
    </div>
  );
}