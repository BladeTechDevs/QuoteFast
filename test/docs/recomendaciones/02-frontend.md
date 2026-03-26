# Recomendaciones — Frontend (Next.js + React)

## 1. Error Boundaries 🔴 Crítico

Si un componente lanza una excepción no capturada, toda la app se rompe con una pantalla en blanco. Esto es inaceptable en producción.

**Crear `src/components/ErrorBoundary.tsx`:**
```typescript
'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Aquí enviar a Sentry o similar
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-xl font-semibold text-gray-800">Algo salió mal</h2>
          <p className="text-gray-500 mt-2">Por favor recarga la página</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usar en el layout principal:**
```typescript
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

---

## 2. Optimistic Updates con TanStack Query 🟡 Importante

Actualmente la UI espera la respuesta del servidor antes de actualizar. Esto hace que la app se sienta lenta.

**Ejemplo para cambio de status de cotización:**
```typescript
const updateQuote = useMutation({
  mutationFn: (data) => api.quotes.update(id, data),
  onMutate: async (newData) => {
    // Cancelar queries en vuelo
    await queryClient.cancelQueries({ queryKey: ['quotes', id] });
    // Guardar snapshot
    const previous = queryClient.getQueryData(['quotes', id]);
    // Actualizar cache optimistamente
    queryClient.setQueryData(['quotes', id], (old) => ({ ...old, ...newData }));
    return { previous };
  },
  onError: (err, newData, context) => {
    // Revertir si falla
    queryClient.setQueryData(['quotes', id], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['quotes', id] });
  },
});
```

---

## 3. Skeleton Loaders 🟡 Importante

Las pantallas muestran nada mientras cargan. Esto genera una experiencia de "parpadeo" que se siente poco profesional.

**Crear componente `SkeletonRow.tsx`:**
```typescript
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}
```

**Usar en listas:**
```typescript
{isLoading
  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
  : quotes.map(q => <QuoteRow key={q.id} quote={q} />)
}
```

---

## 4. Búsqueda Global con Debounce 🟡 Importante

No hay forma de buscar cotizaciones por título, cliente o monto. Con 50+ cotizaciones, la lista se vuelve inmanejable.

**Hook `useDebounce`:**
```typescript
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

**Uso en la lista de cotizaciones:**
```typescript
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

const { data } = useQuotes({ search: debouncedSearch });
```

El backend ya soporta filtros en `ListQuotesDto`, solo hay que agregar el campo `search` y el `where` correspondiente.

---

## 5. Auto-save con Indicador Visual 🟡 Importante

El spec menciona auto-save cada 5 segundos, pero no hay indicador visual de que se está guardando. El usuario no sabe si sus cambios están seguros.

**Implementar con `useEffect` + debounce:**
```typescript
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

useEffect(() => {
  if (!isDirty) return;
  setSaveStatus('saving');
  const timer = setTimeout(async () => {
    try {
      await updateQuote(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, 1000);
  return () => clearTimeout(timer);
}, [formData, isDirty]);
```

**Indicador en la UI:**
```typescript
const statusText = {
  idle: '',
  saving: '⏳ Guardando...',
  saved: '✅ Guardado',
  error: '❌ Error al guardar',
};
```

---

## 6. Manejo de Errores de API 🟡 Importante

Actualmente no hay un manejo centralizado de errores de API. Si el servidor devuelve un 422 o 500, el usuario no ve nada útil.

**Interceptor de errores en `api.ts`:**
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message: string }>) => {
    const message = error.response?.data?.message ?? 'Error inesperado';
    // Disparar toast de error
    toast.error(Array.isArray(message) ? message.join(', ') : message);
    return Promise.reject(error);
  }
);
```

---

## 7. Accesibilidad Básica 🟡 Importante

Los componentes interactivos no tienen ARIA labels. Esto afecta a usuarios con lectores de pantalla y también al SEO.

**Checklist mínimo:**
- Todos los `<button>` sin texto visible deben tener `aria-label`
- Los `<input>` deben tener `<label>` asociado (no solo placeholder)
- Los modales deben tener `role="dialog"` y `aria-modal="true"`
- Las tablas deben tener `<caption>` o `aria-label`
- Los badges de status deben tener texto alternativo para screen readers
- El foco debe ser visible (no remover `outline` sin reemplazarlo)

**Ejemplo:**
```typescript
// Mal:
<button onClick={deleteQuote}>🗑️</button>

// Bien:
<button onClick={deleteQuote} aria-label="Eliminar cotización">🗑️</button>
```

---

## 8. Variables de Entorno Tipadas 🟢 Nice to have

Acceder a `process.env.NEXT_PUBLIC_API_URL` sin validación puede causar errores silenciosos.

**Crear `src/lib/env.ts`:**
```typescript
const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const;

// Validar en desarrollo
if (process.env.NODE_ENV === 'development') {
  Object.entries(env).forEach(([key, value]) => {
    if (!value) console.warn(`Missing env var: ${key}`);
  });
}

export { env };
```

---

## 9. Internacionalización (i18n) 🟢 Nice to have

El spec menciona LATAM como mercado principal, pero la app está en inglés/español mezclado. Definir un idioma base y preparar la estructura para i18n desde ahora es mucho más barato que hacerlo después.

**Opción recomendada: `next-intl`**
```bash
npm install next-intl
```

Estructura de mensajes:
```
src/
  messages/
    es.json   ← idioma principal
    en.json
```

---

## 10. Soporte Offline para Borradores 🟢 Nice to have

Si el usuario pierde conexión mientras crea una cotización, pierde todo el trabajo. Guardar borradores en `localStorage` como fallback es relativamente simple.

```typescript
// Guardar en localStorage como backup
useEffect(() => {
  if (isDirty) {
    localStorage.setItem(`quote-draft-${id}`, JSON.stringify(formData));
  }
}, [formData, isDirty]);

// Al cargar, recuperar si hay draft local más reciente
useEffect(() => {
  const draft = localStorage.getItem(`quote-draft-${id}`);
  if (draft) {
    const parsed = JSON.parse(draft);
    if (new Date(parsed.updatedAt) > new Date(quote.updatedAt)) {
      // Ofrecer al usuario restaurar el draft
    }
  }
}, []);
```
