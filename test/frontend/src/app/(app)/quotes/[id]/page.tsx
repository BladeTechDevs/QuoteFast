'use client';

import { useQuoteDetail } from '@/lib/hooks/useQuoteDetail';
import { QuoteEditor } from '@/components/quotes/QuoteEditor';

interface Props {
  params: { id: string };
}

export default function QuoteDetailPage({ params }: Props) {
  const { id } = params;
  const { data: quote, isLoading, isError } = useQuoteDetail(id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="p-6 text-center text-sm text-red-600">
        No se pudo cargar la cotización.
      </div>
    );
  }

  return <QuoteEditor quote={quote} />;
}
