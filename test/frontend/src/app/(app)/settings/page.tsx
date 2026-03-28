'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranding, useUpdateBranding } from '@/lib/hooks/useBranding';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface PlanUsage {
  plan: string;
  quotesThisMonth: number;
  quotesLimit: number | null;
  quotesRemaining: number | null;
  periodStart: string;
  periodEnd: string;
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  PRO: 'Pro',
  TEAM: 'Equipo',
  BUSINESS: 'Business',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  PRO: 'bg-blue-100 text-blue-700',
  TEAM: 'bg-purple-100 text-purple-700',
  BUSINESS: 'bg-amber-100 text-amber-700',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function BrandingSection() {
  const { data: branding, isLoading } = useBranding();
  const { mutateAsync: updateBranding, isPending, isSuccess } = useUpdateBranding();

  const [form, setForm] = useState({
    logoUrl: '',
    primaryColor: '#2563eb',
    accentColor: '#1d4ed8',
    footerText: '',
    companyName: '',
  });
  const [initialized, setInitialized] = useState(false);

  if (branding && !initialized) {
    setForm({
      logoUrl: branding.logoUrl ?? '',
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      footerText: branding.footerText ?? '',
      companyName: branding.companyName ?? '',
    });
    setInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBranding({
      logoUrl: form.logoUrl || null,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      footerText: form.footerText || null,
      companyName: form.companyName || null,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Branding</h2>
      <p className="text-xs text-gray-500">
        Personaliza como aparece tu empresa en las cotizaciones publicas.
      </p>

      {isLoading ? (
        <div className="h-10 flex items-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de empresa (en cotizaciones)"
            placeholder="Acme Corp"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <Input
            label="URL del logo"
            placeholder="https://cdn.ejemplo.com/logo.png"
            value={form.logoUrl}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            helperText="URL publica de tu logo (PNG, SVG recomendado)"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Color primario</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 p-0.5"
                />
                <span className="text-sm text-gray-500 font-mono">{form.primaryColor}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Color de acento</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 p-0.5"
                />
                <span className="text-sm text-gray-500 font-mono">{form.accentColor}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Texto de pie de pagina</label>
            <textarea
              value={form.footerText}
              onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
              placeholder="Gracias por su preferencia."
              rows={2}
              maxLength={500}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-gray-400 resize-none"
            />
            <p className="text-xs text-gray-400">{form.footerText.length}/500</p>
          </div>

          <div className="rounded-lg overflow-hidden border border-gray-200">
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{
                background: `linear-gradient(to right, ${form.primaryColor}, ${form.accentColor})`,
              }}
            >
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-7 w-auto object-contain rounded"
                />
              )}
              <span className="text-white text-sm font-semibold">
                {form.companyName || 'Tu empresa'}
              </span>
            </div>
            {form.footerText && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-400">{form.footerText}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={isPending}>
              Guardar branding
            </Button>
            {isSuccess && (
              <span className="text-sm text-green-600">Guardado correctamente</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  const { data: usage, isLoading } = useQuery<PlanUsage>({
    queryKey: ['plan-usage'],
    queryFn: async () => {
      const { data } = await apiClient.get<PlanUsage>('/auth/usage');
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Configuracion</h1>

      {/* Profile */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Perfil</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Nombre</p>
            <p className="font-medium text-gray-900">{user?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="font-medium text-gray-900">{user?.email ?? '—'}</p>
          </div>
          {user?.company && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Empresa</p>
              <p className="font-medium text-gray-900">{user.company}</p>
            </div>
          )}
        </div>
      </div>

      {/* Branding */}
      <BrandingSection />

      {/* Plan & Usage */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Plan y uso</h2>

        {isLoading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : usage ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  PLAN_COLORS[usage.plan] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {PLAN_LABELS[usage.plan] ?? usage.plan}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm text-gray-600">Cotizaciones este mes</p>
                <p className="text-sm font-semibold text-gray-900">
                  {usage.quotesThisMonth}
                  {usage.quotesLimit !== null ? ` / ${usage.quotesLimit}` : ''}
                </p>
              </div>

              {usage.quotesLimit !== null && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usage.quotesRemaining === 0
                          ? 'bg-red-500'
                          : usage.quotesThisMonth / usage.quotesLimit >= 0.8
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (usage.quotesThisMonth / usage.quotesLimit) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {usage.quotesRemaining === 0
                      ? 'Limite alcanzado'
                      : `${usage.quotesRemaining} cotizacion${usage.quotesRemaining !== 1 ? 'es' : ''} restante${usage.quotesRemaining !== 1 ? 's' : ''}`}
                  </p>
                </>
              )}

              {usage.quotesLimit === null && (
                <p className="text-xs text-gray-400 mt-1">Sin limite mensual</p>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Periodo: {fmtDate(usage.periodStart)} — {fmtDate(usage.periodEnd)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
