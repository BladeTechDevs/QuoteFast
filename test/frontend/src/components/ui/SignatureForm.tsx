'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SignatureCanvas, type SignatureCanvasRef } from './SignatureCanvas';
import { useSignQuote } from '@/lib/hooks/usePublicQuote';

// Zod validation schema — signatureImage is optional
const signatureSchema = z.object({
  signerName: z
    .string()
    .min(1, 'Por favor ingrese su nombre')
    .max(255, 'El nombre no puede exceder 255 caracteres'),
  signatureImage: z
    .string()
    .refine(
      (val) => val === '' || val.startsWith('data:image/png;base64,'),
      'Formato de firma inválido'
    )
    .refine(
      (val) => val === '' || val.length * 0.75 <= 5 * 1024 * 1024,
      'La firma es demasiado grande'
    )
    .optional()
    .default(''),
});

type SignatureFormData = z.infer<typeof signatureSchema>;

export interface SignatureResult {
  signerName: string;
  signatureImage: string;
}

export interface SignatureFormProps {
  publicId: string;
  onSuccess: (result: SignatureResult) => void;
}

export function SignatureForm({ publicId, onSuccess }: SignatureFormProps) {
  const canvasRef = useRef<SignatureCanvasRef>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignatureFormData>({
    resolver: zodResolver(signatureSchema),
    defaultValues: {
      signerName: '',
      signatureImage: '',
    },
  });

  const { mutate, isPending, error: apiError } = useSignQuote(publicId);

  const handleCanvasChange = (dataUrl: string | null) => {
    setValue('signatureImage', dataUrl ?? '', { shouldValidate: false });
  };

  const handleClear = () => {
    canvasRef.current?.clear();
    setValue('signatureImage', '', { shouldValidate: false });
  };

  const onSubmit = (data: SignatureFormData) => {
    mutate(
      { signerName: data.signerName, signatureImage: data.signatureImage ?? '' },
      {
        onSuccess: () =>
          onSuccess({ signerName: data.signerName, signatureImage: data.signatureImage ?? '' }),
      }
    );
  };

  // Map API errors to user-friendly messages
  const getApiErrorMessage = (): string | null => {
    if (!apiError) return null;
    const err = apiError as { response?: { status?: number; data?: { error?: string } } };
    const status = err.response?.status;
    if (status === 400) return err.response?.data?.error ?? 'Error en la solicitud';
    if (status === 404) return 'Cotización no encontrada';
    if (status === 409) return 'Esta cotización ya no puede ser firmada';
    if (status === 500) return 'Error del servidor. Intenta de nuevo más tarde.';
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
  };

  const apiErrorMessage = getApiErrorMessage();

  return (
    <form onSubmit={handleSubmit(onSubmit)} data-testid="signature-form" noValidate>
      <div className="flex flex-col gap-4">
        {/* Signer name field */}
        <div className="flex flex-col gap-1">
          <label htmlFor="signerName" className="text-sm font-medium text-gray-700">
            Nombre completo
          </label>
          <input
            id="signerName"
            className="w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 border-gray-300 bg-white hover:border-gray-400"
            aria-describedby={errors.signerName ? 'signerName-error' : undefined}
            disabled={isPending}
            {...register('signerName')}
          />
          {errors.signerName && (
            <p id="signerName-error" className="text-xs text-red-600" role="alert">
              {errors.signerName.message}
            </p>
          )}
        </div>

        {/* Signature canvas — optional */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-0.5">
            <label className="text-sm font-medium text-gray-700">Firma</label>
            <span className="text-xs text-gray-400">(opcional)</span>
          </div>
          <SignatureCanvas
            ref={canvasRef}
            onChange={handleCanvasChange}
            aria-describedby={errors.signatureImage ? 'signatureImage-error' : undefined}
          />
          {errors.signatureImage && (
            <p id="signatureImage-error" className="text-xs text-red-600" role="alert">
              {errors.signatureImage.message}
            </p>
          )}
        </div>

        {/* API-level error */}
        {apiErrorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {apiErrorMessage}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            aria-label="Limpiar firma"
            disabled={isPending}
            onClick={handleClear}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpiar
          </button>
          <button
            type="submit"
            aria-busy={isPending}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            Firmar
          </button>
        </div>
      </div>
    </form>
  );
}
