import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// ─── Axios mock ────────────────────────────────────────────────────────────────
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

// ─── SignatureCanvas mock ───────────────────────────────────────────────────────
vi.mock('./SignatureCanvas', () => ({
  SignatureCanvas: vi.fn(({ onChange }: { onChange: (dataUrl: string | null) => void }) => (
    <div data-testid="mock-canvas">
      <button
        type="button"
        onClick={() => onChange('data:image/png;base64,' + 'A'.repeat(100))}
      >
        draw
      </button>
    </div>
  )),
}));

// ─── Canvas prototype mocks ────────────────────────────────────────────────────
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  strokeStyle: '#000000',
  lineWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
})) as any;
HTMLCanvasElement.prototype.toDataURL = vi.fn(
  () => 'data:image/png;base64,mockBase64Data',
);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  top: 0, left: 0, right: 500, bottom: 200,
  width: 500, height: 200, x: 0, y: 0, toJSON: () => {},
}));

// ─── Import component after mocks ─────────────────────────────────────────────
import { SignatureForm } from './SignatureForm';

// ─── QueryClient wrapper ───────────────────────────────────────────────────────
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderForm = (publicId = 'test-id', onSuccess = vi.fn()) => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <SignatureForm publicId={publicId} onSuccess={onSuccess} />
    </Wrapper>,
  );
};

const fillName = (name: string) => {
  fireEvent.change(screen.getByLabelText('Nombre completo'), {
    target: { value: name },
  });
};

const triggerDraw = () => fireEvent.click(screen.getByText('draw'));

const submitForm = () =>
  fireEvent.click(screen.getByRole('button', { name: /firmar/i }));

// ══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('SignatureForm', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────────
  describe('Rendering', () => {
    it('renders the form with data-testid="signature-form"', () => {
      renderForm();
      expect(screen.getByTestId('signature-form')).toBeInTheDocument();
    });

    it('renders the name input with label "Nombre completo"', () => {
      renderForm();
      expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    });

    it('renders the mock canvas', () => {
      renderForm();
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });

    it('renders "Firmar" submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /firmar/i })).toBeInTheDocument();
    });

    it('renders "Limpiar" clear button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
    });
  });

  // ── Button labels ─────────────────────────────────────────────────────────────
  describe('Button labels', () => {
    it('sign button has text "Firmar"', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /firmar/i }).textContent).toContain('Firmar');
    });

    it('clear button has text "Limpiar"', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /limpiar/i }).textContent).toContain('Limpiar');
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────────
  describe('Loading state', () => {
    it('disables buttons and shows spinner while submitting', async () => {
      let resolvePost!: (v: unknown) => void;
      mockPost.mockReturnValue(new Promise((res) => { resolvePost = res; }));

      renderForm();
      fillName('Test User');
      triggerDraw();
      submitForm();

      await waitFor(() => {
        const signBtn = screen.getByRole('button', { name: /firmar/i });
        expect(signBtn).toBeDisabled();
        expect(signBtn.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /limpiar firma/i })).toBeDisabled();
      });

      resolvePost({ data: {} });
    });

    it('sets aria-busy=true on sign button during submission', async () => {
      let resolvePost!: (v: unknown) => void;
      mockPost.mockReturnValue(new Promise((res) => { resolvePost = res; }));

      renderForm();
      fillName('Test User');
      triggerDraw();
      submitForm();

      await waitFor(() => {
        const signBtn = screen.getByRole('button', { name: /firmar/i });
        expect(signBtn).toHaveAttribute('aria-busy', 'true');
      });

      resolvePost({ data: {} });
    });
  });

  // ── Success callback ──────────────────────────────────────────────────────────
  describe('Success callback', () => {
    it('calls onSuccess after successful submission', async () => {
      mockPost.mockResolvedValue({ data: { message: 'Quote signed successfully' } });
      const onSuccess = vi.fn();

      renderForm('test-id', onSuccess);
      fillName('Test User');
      triggerDraw();
      submitForm();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    });
  });

  // ── Validation errors ─────────────────────────────────────────────────────────
  describe('Validation errors', () => {
    it('allows submitting without drawing a signature (optional)', async () => {
      mockPost.mockResolvedValue({ data: { message: 'Quote signed successfully' } });
      const onSuccess = vi.fn();
      renderForm('test-id', onSuccess);
      fillName('Test User');
      // No triggerDraw — canvas is optional
      submitForm();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    });

    it('shows "Por favor ingrese su nombre" when name is empty', async () => {
      renderForm();
      triggerDraw();
      submitForm();

      await waitFor(() => {
        expect(screen.getByText('Por favor ingrese su nombre')).toBeInTheDocument();
      });
    });

    it('shows "El nombre no puede exceder 255 caracteres" for name > 255 chars', async () => {
      renderForm();
      fillName('A'.repeat(256));
      triggerDraw();
      submitForm();

      await waitFor(() => {
        expect(
          screen.getByText('El nombre no puede exceder 255 caracteres'),
        ).toBeInTheDocument();
      });
    });
  });

  // ── API error messages ────────────────────────────────────────────────────────
  describe('API error messages', () => {
    const submitValidForm = async () => {
      fillName('Test User');
      triggerDraw();
      submitForm();
    };

    it('shows API error message for 400 response', async () => {
      mockPost.mockRejectedValue({
        response: { status: 400, data: { error: 'Datos inválidos' } },
      });
      renderForm();
      await submitValidForm();

      await waitFor(() => {
        expect(screen.getByText('Datos inválidos')).toBeInTheDocument();
      });
    });

    it('shows "Cotización no encontrada" for 404 response', async () => {
      mockPost.mockRejectedValue({
        response: { status: 404, data: { error: 'Not found' } },
      });
      renderForm();
      await submitValidForm();

      await waitFor(() => {
        expect(screen.getByText('Cotización no encontrada')).toBeInTheDocument();
      });
    });

    it('shows "Esta cotización ya no puede ser firmada" for 409 response', async () => {
      mockPost.mockRejectedValue({
        response: { status: 409, data: { error: 'Conflict' } },
      });
      renderForm();
      await submitValidForm();

      await waitFor(() => {
        expect(
          screen.getByText('Esta cotización ya no puede ser firmada'),
        ).toBeInTheDocument();
      });
    });

    it('shows "Error del servidor. Intenta de nuevo más tarde." for 500 response', async () => {
      mockPost.mockRejectedValue({
        response: { status: 500, data: { error: 'Server error' } },
      });
      renderForm();
      await submitValidForm();

      await waitFor(() => {
        expect(
          screen.getByText('Error del servidor. Intenta de nuevo más tarde.'),
        ).toBeInTheDocument();
      });
    });

    it('shows "Error de conexión. Verifica tu internet e intenta de nuevo." for network error', async () => {
      mockPost.mockRejectedValue({ message: 'Network Error' });
      renderForm();
      await submitValidForm();

      await waitFor(() => {
        expect(
          screen.getByText(
            'Error de conexión. Verifica tu internet e intenta de nuevo.',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  // ── Responsive layout ─────────────────────────────────────────────────────────
  describe('Responsive layout', () => {
    it('buttons container has flex-col and sm:flex-row classes', () => {
      const { container } = renderForm();
      const buttonsDiv = container.querySelector('.flex-col.sm\\:flex-row');
      expect(buttonsDiv).toBeInTheDocument();
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────
  describe('Accessibility', () => {
    it('clear button has aria-label="Limpiar firma"', () => {
      renderForm();
      expect(
        screen.getByRole('button', { name: 'Limpiar firma' }),
      ).toBeInTheDocument();
    });

    it('sign button has aria-busy=false when not submitting', () => {
      renderForm();
      const signBtn = screen.getByRole('button', { name: /firmar/i });
      expect(signBtn).toHaveAttribute('aria-busy', 'false');
    });

    it('name input has aria-describedby pointing to error id when error is shown', async () => {
      renderForm();
      triggerDraw();
      submitForm();

      await waitFor(() => {
        const input = screen.getByLabelText('Nombre completo');
        expect(input).toHaveAttribute('aria-describedby', 'signerName-error');
        expect(document.getElementById('signerName-error')).toBeInTheDocument();
      });
    });

    it('signature error element has role="alert" and correct id', async () => {
      renderForm();
      fillName('Test User');
      submitForm();

      await waitFor(() => {
        const errorEl = document.getElementById('signatureImage-error');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveAttribute('role', 'alert');
      });
    });
  });
});
