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
├── templates/    → gestión de plantillas
└── ErrorBoundary.tsx
```

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
