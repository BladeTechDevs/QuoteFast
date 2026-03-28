# Testing

## Backend (Jest)

Framework: Jest 29 con ts-jest.

### Ejecutar Tests

```bash
cd test/backend
npm run test          # Modo watch
npm run test:run      # Una sola ejecución (CI)
```

### Tipos de Tests

**Tests unitarios** (`*.spec.ts`):
- `auth/auth.service.spec.ts` — lógica de autenticación
- `public/signature.service.spec.ts` — servicio de firmas

**Tests basados en propiedades** (`*.pbt.spec.ts`) con fast-check:
- `dashboard/dashboard.metrics.pbt.spec.ts` — invariantes de métricas
- `public/signature.*.pbt.spec.ts` — propiedades de firmas (concurrencia, idempotencia, persistencia, respuesta, transiciones de estado, tracking, validación)
- `public/public-quotes.service.state-transitions.pbt.spec.ts` — transiciones de estado de cotizaciones
- `quote-items/quote-items.service.pbt.spec.ts` — propiedades de ítems
- `quote-items/quote-items.totals.pbt.spec.ts` — invariantes de cálculo de totales
- `quotes/quotes.expiry.pbt.spec.ts` — lógica de vencimiento
- `quotes/quotes.publicid.pbt.spec.ts` — unicidad de IDs públicos
- `quotes/quotes.service.pbt.spec.ts` — propiedades del servicio de cotizaciones

---

## Frontend (Vitest)

Framework: Vitest 4 con React Testing Library.

### Ejecutar Tests

```bash
cd test/frontend
npm run test          # Una sola ejecución
npm run test:watch    # Modo watch
```

### Tipos de Tests

**Tests de componentes** (`*.test.tsx`):
- `components/ui/SignatureForm.test.tsx` — tests del formulario de firma

**Tests basados en propiedades** (`*.pbt.test.tsx`) con fast-check:
- `components/ui/SignatureForm.pbt.test.tsx` — propiedades del formulario de firma

---

## Convenciones

- Los archivos de test unitario usan el sufijo `.spec.ts` (backend) o `.test.tsx` (frontend).
- Los tests de propiedades usan el sufijo `.pbt.spec.ts` o `.pbt.test.tsx`.
- Los tests de propiedades verifican invariantes del sistema con datos generados aleatoriamente, lo que aumenta la cobertura de casos borde.
