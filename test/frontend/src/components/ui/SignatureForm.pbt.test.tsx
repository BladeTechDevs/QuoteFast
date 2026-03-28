import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, within, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import fc from 'fast-check';
import { z } from 'zod';

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

vi.mock('./SignatureCanvas', () => ({
  SignatureCanvas: vi.fn(({ onChange }: { onChange: (d: string | null) => void }) => (
    <div data-testid="mock-canvas">
      <button type="button" data-testid="draw-btn"
        onClick={() => onChange('data:image/png;base64,' + 'A'.repeat(100))}>
        draw
      </button>
    </div>
  )),
}));

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  strokeStyle: '#000000', lineWidth: 2, lineCap: 'round', lineJoin: 'round',
  beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(),
})) as any;
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockBase64Data');
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  top: 0, left: 0, right: 500, bottom: 200, width: 500, height: 200, x: 0, y: 0, toJSON: () => {},
}));

import { SignatureForm } from './SignatureForm';

const signatureSchema = z.object({
  signerName: z.string().min(1, 'Por favor ingrese su nombre').max(255, 'El nombre no puede exceder 255 caracteres'),
  signatureImage: z.string()
    .min(1, 'Por favor dibuje su firma')
    .refine((v) => v.startsWith('data:image/png;base64,'), 'Formato de firma invalido')
    .refine((v) => v.length * 0.75 <= 5 * 1024 * 1024, 'La firma es demasiado grande'),
});

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const renderForm = (publicId = 'test-id', onSuccess = vi.fn()) => {
  const Wrapper = createWrapper();
  const result = render(<Wrapper><SignatureForm publicId={publicId} onSuccess={onSuccess} /></Wrapper>);
  const scope = within(result.container);
  return {
    ...result, scope,
    fillName: (n: string) => fireEvent.change(scope.getByLabelText('Nombre completo'), { target: { value: n } }),
    triggerDraw: () => fireEvent.click(scope.getByTestId('draw-btn')),
    submitForm: () => fireEvent.click(scope.getByRole('button', { name: /firmar/i })),
  };
};


describe('SignatureForm – Property-Based Tests', () => {
  beforeEach(() => { mockPost.mockReset(); });
  afterEach(() => { cleanup(); });

  // Feature: signature-ui-frontend, Property 4: Empty canvas validation
  describe('Property 4: Empty canvas validation', () => {
    it('fails with "Por favor dibuje su firma" for any empty signatureImage', () => {
      // **Validates: Requirements 4.1**
      fc.assert(
        fc.property(
          fc.constantFrom('', null as unknown as string, undefined as unknown as string),
          (emptyValue) => {
            const r = signatureSchema.safeParse({ signerName: 'Valid Name', signatureImage: emptyValue ?? '' });
            expect(r.success).toBe(false);
            if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain('Por favor dibuje su firma');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 5: Empty name validation
  describe('Property 5: Empty name validation', () => {
    it('fails with "Por favor ingrese su nombre" for empty/whitespace signerName', () => {
      // **Validates: Requirements 4.2**
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(''), fc.stringOf(fc.constantFrom(' ', '\t', '\n'))),
          (emptyName) => {
            const r = signatureSchema.safeParse({ signerName: emptyName, signatureImage: 'data:image/png;base64,' + 'A'.repeat(100) });
            expect(r.success).toBe(false);
            if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain('Por favor ingrese su nombre');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 6: Name length validation
  describe('Property 6: Name length validation', () => {
    it('fails with "El nombre no puede exceder 255 caracteres" for names > 255 chars', () => {
      // **Validates: Requirements 4.3**
      fc.assert(
        fc.property(
          fc.string({ minLength: 256, maxLength: 500 }),
          (longName) => {
            const r = signatureSchema.safeParse({ signerName: longName, signatureImage: 'data:image/png;base64,' + 'A'.repeat(100) });
            expect(r.success).toBe(false);
            if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain('El nombre no puede exceder 255 caracteres');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 7: Submission prevention with validation errors
  describe('Property 7: Submission prevention with validation errors', () => {
    it('does not call API when form has validation errors', async () => {
      // **Validates: Requirements 4.4**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(fc.constant(''), fc.stringOf(fc.constantFrom(' ', '\t', '\n')), fc.string({ minLength: 256, maxLength: 300 })),
            drawSignature: fc.boolean(),
          }),
          async ({ name, drawSignature }) => {
            mockPost.mockReset();
            const { fillName, triggerDraw, submitForm, scope } = renderForm();
            fillName(name);
            if (drawSignature) triggerDraw();
            submitForm();
            await waitFor(() => { expect(scope.queryAllByRole('alert').length).toBeGreaterThan(0); });
            expect(mockPost).not.toHaveBeenCalled();
            cleanup();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 8: Error clearing on input correction
  describe('Property 8: Error clearing on input correction', () => {
    it('schema passes for valid data after failing for invalid data', () => {
      // **Validates: Requirements 4.5**
      fc.assert(
        fc.property(
          fc.record({
            validName: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
            validImage: fc.constant('data:image/png;base64,' + 'A'.repeat(100)),
          }),
          ({ validName, validImage }) => {
            expect(signatureSchema.safeParse({ signerName: '', signatureImage: '' }).success).toBe(false);
            expect(signatureSchema.safeParse({ signerName: validName, signatureImage: validImage }).success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 13: PNG data URI format validation
  describe('Property 13: PNG data URI format validation', () => {
    it('fails for signatureImage not starting with "data:image/png;base64,"', () => {
      // **Validates: Requirements 11.5**
      fc.assert(
        fc.property(
          fc.string().filter((s) => s.length > 0 && !s.startsWith('data:image/png;base64,')),
          (invalidImage) => {
            const r = signatureSchema.safeParse({ signerName: 'Valid Name', signatureImage: invalidImage });
            expect(r.success).toBe(false);
            if (!r.success) {
              const msgs = r.error.issues.map((i) => i.message);
              expect(msgs.some((m) => m === 'Formato de firma invalido' || m === 'Por favor dibuje su firma')).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 10: API submission with valid data
  describe('Property 10: API submission with valid data', () => {
    it('POSTs to correct endpoint with correct payload for valid form data', async () => {
      // **Validates: Requirements 5.3**
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
          async (validName) => {
            mockPost.mockReset();
            mockPost.mockResolvedValue({ data: { message: 'Quote signed successfully' } });
            const publicId = 'test-public-id';
            const { fillName, triggerDraw, submitForm } = renderForm(publicId);
            fillName(validName);
            triggerDraw();
            submitForm();
            await waitFor(() => {
              expect(mockPost).toHaveBeenCalledWith(
                `/public/quotes/${publicId}/sign`,
                { signerName: validName, signatureImage: 'data:image/png;base64,' + 'A'.repeat(100) },
              );
            });
            cleanup();
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 11: Button re-enabling after error
  describe('Property 11: Button re-enabling after error', () => {
    it('re-enables sign and clear buttons after any API error', async () => {
      // **Validates: Requirements 7.6**
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({ type: fc.constant('http' as const), status: fc.constantFrom(400, 404, 409, 500) }),
            fc.record({ type: fc.constant('network' as const) }),
          ),
          async (errorSpec) => {
            mockPost.mockReset();
            if (errorSpec.type === 'http') {
              mockPost.mockRejectedValue({ response: { status: errorSpec.status, data: { error: 'Some error' } } });
            } else {
              mockPost.mockRejectedValue({ message: 'Network Error' });
            }
            const { fillName, triggerDraw, submitForm, scope } = renderForm();
            fillName('Valid Name');
            triggerDraw();
            submitForm();
            await waitFor(() => {
              expect(scope.getByRole('button', { name: /firmar/i })).not.toBeDisabled();
              expect(scope.getByRole('button', { name: /limpiar firma/i })).not.toBeDisabled();
            });
            cleanup();
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 12: Form data preservation after error
  describe('Property 12: Form data preservation after error', () => {
    it('preserves signerName after any API error', async () => {
      // **Validates: Requirements 7.7**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
            status: fc.constantFrom(400, 404, 409, 500),
          }),
          async ({ name, status }) => {
            mockPost.mockReset();
            mockPost.mockRejectedValue({ response: { status, data: { error: 'Some error' } } });
            const { fillName, triggerDraw, submitForm, scope } = renderForm();
            fillName(name);
            triggerDraw();
            submitForm();
            await waitFor(() => {
              expect((scope.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe(name);
            });
            cleanup();
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // Feature: signature-ui-frontend, Property 14: Error message accessibility association
  describe('Property 14: Error message accessibility association', () => {
    it('associates error messages with inputs via aria-describedby', async () => {
      // **Validates: Requirements 12.4**
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const { submitForm, container } = renderForm();
            submitForm();
            await waitFor(() => {
              const sigError = container.querySelector('#signatureImage-error');
              expect(sigError).not.toBeNull();
              expect(sigError?.getAttribute('role')).toBe('alert');
              const nameError = container.querySelector('#signerName-error');
              expect(nameError).not.toBeNull();
              e