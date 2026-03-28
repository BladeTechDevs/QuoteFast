# Frontend

Framework: Next.js 14 con App Router. Lenguaje: TypeScript 5.4.

## Estructura de Carpetas

```
src/
├── app/
│   ├── (app)/              # Rutas protegidas (requieren login)
│   │   ├── dashboard/      # Panel principal con métricas
│   │   ├── quotes/         # Gestión de cotizaciones
│   │   ├── clients/        # Gestión de clientes
│   │   ├── templates/      # Gestión de plantillas
│   │   └── settings/       # Configuración de perfil y plan
│   ├── (public)/           # Rutas públicas
│   │   ├── login/          # Inicio de sesión
│   │   └── register/       # Registro de usuario
│   └── q/[publicId]/       # Vista pública de cotización (sin auth)
├── components/
│   ├── ui/                 # Componentes reutilizables (SignatureCanvas, SignatureForm, StatusBadge, etc.)
│   ├── quotes/             # Componentes de cotizaciones
│   ├── clients/            # Componentes de clientes
│   ├── templates/          # Componentes de plantillas
│   ├── layout/             # Layout y navegación
│   └── ErrorBoundary.tsx   # Manejo de errores
├── lib/
│   ├── api.ts              # Cliente HTTP (Axios)
│   ├── types.ts            # Tipos TypeScript compartidos
│   ├── query-client.ts     # Configuración de TanStack Query
│   └── hooks/              # Custom hooks
└── providers/
    ├── AuthProvider.tsx    # Contexto de autenticación
    └── QueryProvider.tsx   # Proveedor de TanStack Query
```

## Stack Tecnológico

| Librería | Versión | Uso |
|----------|---------|-----|
| Next.js | 14.2 | Framework principal, App Router |
| React | 18.3 | UI |
| TypeScript | 5.4 | Tipado estático |
| Tailwind CSS | 3.4 | Estilos |
| TanStack Query | 5.40 | Fetching y caché de datos del servidor |
| React Hook Form | 7.52 | Gestión de formularios |
| Zod | 3.23 | Validación de esquemas |
| Axios | 1.7 | Cliente HTTP |
| js-cookie | 3.0 | Manejo de cookies (tokens) |

## Autenticación

- Los tokens se almacenan en cookies via `js-cookie`.
- `AuthProvider` expone el contexto de usuario y funciones de login/logout.
- Las rutas bajo `(app)/` verifican autenticación; redirigen a `/login` si no hay sesión.
- El access token (15 min) se renueva automáticamente usando el refresh token (7 días).

## Fetching de Datos

Se usa TanStack Query para todas las llamadas al API:

```tsx
const { data: quotes } = useQuery({
  queryKey: ['quotes'],
  queryFn: () => api.get('/quotes').then(r => r.data),
});
```

Las mutaciones invalidan las queries correspondientes para mantener la UI sincronizada.

## Formularios

React Hook Form + Zod para validación:

```tsx
const schema = z.object({
  title: z.string().min(1, 'Requerido'),
  taxRate: z.number().min(0).max(100),
});

const form = useForm({ resolver: zodResolver(schema) });
```

## Firma Electrónica

### SignatureCanvas

Componente canvas reutilizable para captura de firma.

- Soporta eventos de mouse y touch (móvil).
- Expone `ref` con métodos `clear()` y `toDataURL()`.
- Muestra placeholder "Dibuje su firma aquí" cuando está vacío.
- Tamaño responsivo: 300×150 en móvil, 500×200 en desktop.

### SignatureForm

Formulario de firma para la vista pública de cotización.

- Campo "Nombre completo" requerido (máx. 255 caracteres).
- Canvas de firma opcional — el cliente puede firmar solo con nombre.
- Valida formato PNG base64 y tamaño máximo de 5 MB.
- Envía al endpoint `POST /public/quotes/:publicId/sign`.
- Al firmar exitosamente, la cotización queda en estado `ACCEPTED`.
- Muestra errores de API mapeados a mensajes en español.

## Variables de Entorno

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run test         # Ejecutar tests (una vez)
npm run type-check   # Verificar tipos TypeScript
npm run lint         # Linting con ESLint
```
