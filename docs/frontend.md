# Frontend

Framework: **Next.js 14** (App Router) | Lenguaje: **TypeScript** | Puerto: `3000`

## Stack

| Librería | Versión | Uso |
|----------|---------|-----|
| Next.js | 14 | Framework React con App Router |
| React | 18 | UI |
| Tailwind CSS | 3 | Estilos |
| TanStack React Query | 5 | Estado del servidor / caché |
| Axios | 1.7 | Cliente HTTP |
| React Hook Form | 7 | Formularios |
| Zod | 3 | Validación de esquemas |
| js-cookie | 3 | Manejo de cookies (tokens JWT) |
| Vitest | — | Tests unitarios |

## Estructura de Rutas

```
app/
├── (public)/
│   └── login/          → /login
├── (app)/              → rutas protegidas (requieren auth)
│   ├── dashboard/      → /dashboard
│   ├── quotes/
│   │   ├── page.tsx    → /quotes (listado)
│   │   ├── new/        → /quotes/new
│   │   └── [id]/       → /quotes/:id (detalle/edición)
│   ├── clients/        → /clients
│   ├── catalog/        → /catalog (catálogo de productos/servicios)
│   ├── templates/      → /templates
│   └── settings/       → /settings (perfil + branding)
└── q/
    └── [publicId]/     → /q/:publicId (vista pública de cotización)
```

## Autenticación

Manejada por `AuthProvider` (`src/providers/AuthProvider.tsx`):

- Al montar, verifica si hay un `access_token` en cookies y llama a `/auth/me`
- `login()` guarda `accessToken` y `refreshToken` en cookies
- `logout()` limpia cookies y redirige a `/login`
- El contexto expone: `user`, `isLoading`, `login`, `register`, `logout`

## Cliente HTTP (`src/lib/api.ts`)

- Base URL: `/api` (proxy de Next.js hacia el backend en `3001`)
- Interceptor de request: adjunta `Authorization: Bearer <token>`
- Interceptor de response: en 401, intenta refresh automático
  - Si el refresh falla → logout
  - Si hay múltiples requests fallidas simultáneas → se encolan y reintentan con el nuevo token

## Componentes Principales

```
components/
├── ui/           → botones, inputs, modales, badges reutilizables
├── layout/       → sidebar, navbar, layout principal
├── quotes/       → lista, formulario, detalle de cotizaciones
├── clients/      → lista y formulario de clientes
├── catalog/      → gestión del catálogo de productos/servicios
│   ├── CatalogItemModal.tsx   → modal para crear/editar CatalogItems
│   └── CatalogSearch.tsx      → buscador con debounce para pre-llenar QuoteItems
├── templates/    → gestión de plantillas (QuoteTemplates con TemplateItems)
│   ├── TemplateModal.tsx        → drawer lateral para crear/editar QuoteTemplates (incluye TemplateItemsEditor)
│   └── TemplateItemsEditor.tsx  → editor de lista de TemplateItems (modo edición y solo lectura)
└── ErrorBoundary.tsx
```

### CatalogSearch

`src/components/catalog/CatalogSearch.tsx`

Componente de búsqueda de ítems del catálogo para usar dentro del formulario de ítems de una cotización. Muestra un dropdown con resultados en tiempo real y pre-llena los campos del `QuoteItem` al seleccionar.

- Debounce de 300ms sobre el input de búsqueda
- Llama a `useListCatalogItems` solo cuando el dropdown está abierto
- Al seleccionar un ítem, invoca `onSelect` con `{ name, description, unitPrice, taxRate, discount, internalCost }`
- Si el catálogo está vacío, muestra un enlace a `/catalog` para agregar el primer ítem

### CatalogItemModal

`src/components/catalog/CatalogItemModal.tsx`

Modal reutilizable para crear y editar `CatalogItem`. Incluye validación en cliente (nombre obligatorio, `unitPrice >= 0`) y muestra errores del servidor si la operación falla.

### TemplateModal

`src/components/templates/TemplateModal.tsx`

Panel lateral (drawer) de pantalla completa para crear y editar plantillas. Se cierra con la tecla Escape o haciendo clic en el backdrop. Soporta dos modos:

- **Modo QuoteTemplate** (`useQuoteTemplateMode=true` o cuando se pasa `quoteTemplate`): usa `useCreateQuoteTemplate` / `useUpdateQuoteTemplate` e incluye el `TemplateItemsEditor` para gestionar ítems predefinidos. Notas y términos se muestran en columnas lado a lado.
- **Modo Template legado**: usa `useCreateTemplate` / `useUpdateTemplate` sin ítems estructurados (compatibilidad hacia atrás).

Las plantillas del sistema (`isDefault = true`) se muestran en modo solo lectura.

### TemplateItemsEditor

`src/components/templates/TemplateItemsEditor.tsx`

Editor de lista de `TemplateItem` dentro del `TemplateModal`. Permite agregar, editar y eliminar ítems con validación en cliente (nombre obligatorio, `unitPrice >= 0`). En modo `readOnly` muestra los ítems en una tabla sin controles de edición.

## Hooks principales

| Hook | Descripción |
|------|-------------|
| `useQuoteTemplates` | Lista `QuoteTemplate` propias + del sistema con sus `TemplateItem` |
| `useCreateQuoteTemplate` | Crea una `QuoteTemplate` con ítems opcionales |
| `useUpdateQuoteTemplate` | Actualiza metadatos y reemplaza `TemplateItem` |
| `useDeleteQuoteTemplate` | Elimina una `QuoteTemplate` propia (403 en plantillas del sistema) |
| `useSaveQuoteAsTemplate` | Guarda una `Quote` existente como nueva `QuoteTemplate` (POST `/api/quotes/:id/save-as-template`) |
| `useListCatalogItems` | Lista `CatalogItem` del usuario con paginación y búsqueda |
| `useCreateCatalogItem` | Crea un `CatalogItem` |
| `useUpdateCatalogItem` | Actualiza un `CatalogItem` (patch parcial) |
| `useDeleteCatalogItem` | Elimina un `CatalogItem` |

## Página `/templates`

Usa `useQuoteTemplates` y `useDeleteQuoteTemplate` (modelo `QuoteTemplate` con `TemplateItem`). Muestra plantillas propias del usuario y plantillas del sistema en una tabla. Las plantillas del sistema son de solo lectura. El `TemplateModal` se abre en modo `useQuoteTemplateMode=true` para soportar la edición de ítems predefinidos.

## QuoteEditor (`src/components/quotes/QuoteEditor.tsx`)

Usa `useQuoteTemplates` y `useSaveQuoteAsTemplate` (ambos del hook `useQuoteTemplates.ts`) para el selector de plantillas al crear una cotización y el botón "Guardar como plantilla" en el detalle. El selector de plantillas aplica metadatos e ítems de la `QuoteTemplate` seleccionada directamente al formulario local antes de crear la cotización.

## Providers

```
providers/
├── AuthProvider.tsx   → contexto de autenticación
└── QueryProvider.tsx  → TanStack React Query (con devtools en desarrollo)
```

## Variables de Entorno

Archivo: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

En producción, el frontend hace proxy de `/api` hacia el backend, por lo que `NEXT_PUBLIC_API_URL` apunta al dominio del backend.

## Scripts

```bash
npm run dev         # servidor de desarrollo (puerto 3000)
npm run build       # build de producción
npm run start       # servidor de producción
npm run lint        # ESLint
npm run type-check  # TypeScript sin emitir
npm run test        # Vitest (single run)
npm run test:watch  # Vitest en modo watch
```
