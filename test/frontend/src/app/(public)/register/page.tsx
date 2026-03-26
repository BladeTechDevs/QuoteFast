'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';

const registerSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('Email inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: authRegister } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterForm) {
    setServerError(null);
    try {
      await authRegister(data.name, data.email, data.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        setServerError('Este email ya está registrado.');
      } else {
        setServerError('Ocurrió un error. Intenta de nuevo.');
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-blue-600">QuoteFast</span>
          <p className="mt-1 text-sm text-gray-500">Crea tu cuenta gratis</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            label="Nombre"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            loading={isSubmitting}
            className="w-full"
          >
            Crear cuenta
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
