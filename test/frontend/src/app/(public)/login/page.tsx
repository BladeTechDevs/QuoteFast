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

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setServerError(null);
    try {
      await login(data.email, data.password);
      router.replace('/dashboard');
    } catch {
      setServerError('Credenciales incorrectas. Verifica tu email y contraseña.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-blue-600">QuoteFast</span>
          <p className="mt-1 text-sm text-gray-500">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
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
            Iniciar sesión
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
