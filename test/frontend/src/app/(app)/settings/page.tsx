'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

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
  return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
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
      <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>

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

      {/* Plan & Usage */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Plan y uso</h2>

        {isLoading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : usage ? (
          <div className="space-y-4">
            {/* Plan badge */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${PLAN_COLORS[usage.plan] ?? 'bg-gray-100 text-gray-700'}`}>
                {PLAN_LABELS[usage.plan] ?? usage.plan}
              </span>
            </div>

            {/* Quotes usage */}
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
                        usage.quotesRemaining === 0 ? 'bg-red-500' :
                        usage.quotesThisMonth / usage.quotesLimit >= 0.8 ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, (usage.quotesThisMonth / usage.quotesLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {usage.quotesRemaining === 0
                      ? 'Límite alcanzado — no puedes crear más cotizaciones este mes'
                      : `${usage.quotesRemaining} cotización${usage.quotesRemaining !== 1 ? 'es' : ''} restante${usage.quotesRemaining !== 1 ? 's' : ''}`}
                  </p>
                </>
              )}

              {usage.quotesLimit === null && (
                <p className="text-xs text-gray-400 mt-1">Sin límite mensual</p>
              )}
            </div>

            {/* Period */}
            <p className="text-xs text-gray-400">
              Período: {fmtDate(usage.periodStart)} — {fmtDate(usage.periodEnd)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
