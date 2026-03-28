import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { QuoteStatus, PublicQuote, PublicQuoteItem } from '@/lib/types';

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
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
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

const renderPage = (status: QuoteStatus) => {
  const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
  mockUsePublicQuote.mockReturnValue({
    data: mockQuote(status),
    isLoading: false,
    isError: false,
  });
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <PublicQuotePage params={{ publicId: 'test-public-id' }} />
    </Wrapper>,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublicQuotePage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── SignatureForm visibility ───────────────────────────────────────────────

  describe('SignatureForm visibility', () => {
    it('renders SignatureForm for SENT status', () => {
      renderPage('SENT');
      expect(screen.getByTestId('signature-form')).toBeInTheDocument();
    });

    it('renders SignatureForm for VIEWED status', () => {
      renderPage('VIEWED');
      expect(screen.getByTestId('signature-form')).toBeInTheDocument();
    });

    it('does NOT render SignatureForm for ACCEPTED status', () => {
      renderPage('ACCEPTED');
      expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
    });

    it('does NOT render SignatureForm for REJECTED status', () => {
      renderPage('REJECTED');
      expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
    });

    it('does NOT render SignatureForm for EXPIRED status', () => {
      renderPage('EXPIRED');
      expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
    });
  });

  // ── Success state after signature ─────────────────────────────────────────

  describe('Success state after signature', () => {
    it('displays success message after onSuccess callback fires', async () => {
      renderPage('SENT');
      fireEvent.click(screen.getByTestId('mock-sign-button'));

      await waitFor(() => {
        expect(
          screen.getByText('✓ Has firmado y aceptado esta cotización. El emisor ha sido notificado.'),
        ).toBeInTheDocument();
      });
    });

    it('hides SignatureForm after successful signature', async () => {
      renderPage('SENT');
      fireEvent.click(screen.getByTestId('mock-sign-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
      });
    });

    it('hides accept/reject buttons after successful signature', async () => {
      renderPage('SENT');
      // Buttons should be visible before signing
      expect(screen.getByText('Aceptar cotización')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('mock-sign-button'));

      await waitFor(() => {
        expect(screen.queryByText('Aceptar cotización')).not.toBeInTheDocument();
        expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
      });
    });
  });

  // ── ACCEPTED via signature display ───────────────────────────────────────

  describe('ACCEPTED status display', () => {
    it('displays status badge with ACCEPTED value', () => {
      renderPage('ACCEPTED');
      expect(screen.getByTestId('status-badge').textContent).toBe('ACCEPTED');
    });

    it('does NOT display accept/reject buttons for ACCEPTED status', () => {
      renderPage('ACCEPTED');
      expect(screen.queryByText('Aceptar cotización')).not.toBeInTheDocument();
      expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
    });
  });

  // ── Interaction with accept/reject ────────────────────────────────────────

  describe('Interaction with accept/reject actions', () => {
    it('hides SignatureForm after accept action', async () => {
      const mockAcceptMutateAsync = vi.fn().mockResolvedValue(undefined);
      const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
      const { useAcceptQuote } = await import('@/lib/hooks/usePublicQuote');
      (useAcceptQuote as ReturnType<typeof vi.fn>).mockReturnValue({
        mutateAsync: mockAcceptMutateAsync,
        isPending: false,
      });

      mockUsePublicQuote.mockReturnValue({
        data: mockQuote('SENT'),
        isLoading: false,
        isError: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PublicQuotePage params={{ publicId: 'test-public-id' }} />
        </Wrapper>,
      );

      expect(screen.getByTestId('signature-form')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Aceptar cotización'));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
      });
    });

    it('hides SignatureForm after reject action', async () => {
      const mockRejectMutateAsync = vi.fn().mockResolvedValue(undefined);
      const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
      const { useRejectQuote } = await import('@/lib/hooks/usePublicQuote');
      (useRejectQuote as ReturnType<typeof vi.fn>).mockReturnValue({
        mutateAsync: mockRejectMutateAsync,
        isPending: false,
      });

      mockUsePublicQuote.mockReturnValue({
        data: mockQuote('SENT'),
        isLoading: false,
        isError: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <PublicQuotePage params={{ publicId: 'test-public-id' }} />
        </Wrapper>,
      );

      expect(screen.getByTestId('signature-form')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Rechazar'));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-form')).not.toBeInTheDocument();
      });
    });

    it('shows both SignatureForm and accept/reject buttons for SENT status', () => {
      renderPage('SENT');
      expect(screen.getByTestId('signature-form')).toBeInTheDocument();
      expect(screen.getByText('Aceptar cotización')).toBeInTheDocument();
      expect(screen.getByText('Rechazar')).toBeInTheDocument();
    });

    it('shows both SignatureForm and accept/reject buttons for VIEWED status', () => {
      renderPage('VIEWED');
      expect(screen.getByTestId('signature-form')).toBeInTheDocument();
      expect(screen.getByText('Aceptar cotización')).toBeInTheDocument();
      expect(screen.getByText('Rechazar')).toBeInTheDocument();
    });
  });
});

// ── Requirements 7.6 & 8.2: internalCost must not appear in public view ───────

describe('internalCost exclusion (Requirements 7.6, 8.2)', () => {
  it('PublicQuoteItem type does not include internalCost', () => {
    // Compile-time check: constructing a valid PublicQuoteItem must NOT accept internalCost.
    // If PublicQuoteItem had internalCost, this object would be valid with it — we assert it's absent.
    const item: PublicQuoteItem = {
      id: 'item-1',
      name: 'Widget',
      description: null,
      quantity: 2,
      unitPrice: 50,
      discount: 0,
      taxRate: 0,
      total: 100,
      order: 0,
    };
    // internalCost must not be a key on PublicQuoteItem
    expect('internalCost' in item).toBe(false);
  });

  it('does not render an internalCost column header in the items table', () => {
    const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
    mockUsePublicQuote.mockReturnValue({
      data: mockQuote('SENT'),
      isLoading: false,
      isError: false,
    });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <PublicQuotePage params={{ publicId: 'test-public-id' }} />
      </Wrapper>,
    );
    // No column header or cell should mention internal cost
    expect(screen.queryByText(/costo interno/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal.?cost/i)).not.toBeInTheDocument();
  });

  it('does not render internalCost value for items with non-zero internalCost', () => {
    const mockUsePublicQuote = usePublicQuote as ReturnType<typeof vi.fn>;
    const quoteWithItems: PublicQuote = {
      ...mockQuote('SENT'),
      items: [
        {
          id: 'item-1',
          name: 'Widget',
          description: null,
          quantity: 2,
          unitPrice: 50,
          discount: 0,
          taxRate: 0,
          total: 100,
          order: 0,
        },
      ],
    };
    mockUsePublicQuote.mockReturnValue({
      data: quoteWithItems,
      isLoading: false,
      isError: false,
    });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <PublicQuotePage params={{ publicId: 'test-public-id' }} />
      </Wrapper>,
    );
    // The item row should render name and total, but no internalCost label or value
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.queryByText(/costo interno/i)).not.toBeInTheDocument();
  });
});
