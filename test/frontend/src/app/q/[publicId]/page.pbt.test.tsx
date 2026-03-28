// Feature: signature-ui-frontend, Property 1: Form visibility for signable states
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import type { ReactNode } from 'react';
import type { QuoteStatus } from '@/lib/types';
import type { PublicQuote } from '@/lib/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/usePublicQuote', () => ({
  usePublicQuote: vi.fn(),
  useAcceptQuote: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRejectQuote: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTrackPdfDownload: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('@/components/ui/SignatureForm', () => ({
  SignatureForm: ({ onSuccess }: { onSuccess: (result: { signerName: string; signatureImage: string }) => void }) => (
    <div data-testid="signature-form">
      <button
        onClick={() => onSuccess({ signerName: 'Test User', signatureImage: '' })}
        data-testid="mock-sign-button"
      >
        Sign
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

import { usePublicQuote } from '@/lib/hooks/usePublicQuote';
import PublicQuotePage from './page';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockQuote = (status: QuoteStatus): PublicQuote => ({
  publicId: 'test-public-id',
  title: 'Test Quote',
  status,
  currency: 'USD',
  items: [],
  subtotal: 100,
  taxRate: 0,
  taxAmount: 0,
  discount: 0,
  total: 100,
  notes: null,
  terms: null,
  validUntil: null,
  pdfUrl: null,
  issuer: { name: 'Test Issuer', company: null },
  client: null,
  signature: null,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const allStatuses: QuoteStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
const signableStatuses = new Set<QuoteStatus>(['SENT', 'VIEWED']);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('PublicQuotePage - Property 1: Form visibility for signable states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SignatureForm displays if and only if quote status is SENT or VIEWED', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStatuses),
        (status) => {
          const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
          mockUsePublicQuote.mockReturnValue({
            data: mockQuote(status),
            isLoading: false,
            isError: false,
          });

          const Wrapper = createWrapper();
          const { container, unmount } = render(
            <Wrapper>
              <PublicQuotePage params={{ publicId: 'test-public-id' }} />
            </Wrapper>,
          );

          const formPresent = container.querySelector('[data-testid="signature-form"]') !== null;
          const shouldDisplay = signableStatuses.has(status);

          unmount();

          return formPresent === shouldDisplay;
        },
      ),
      { numRuns: 100 },
    );
  });
});
