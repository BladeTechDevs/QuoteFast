# Arquitectura

## Visión General

QuoteFast sigue una arquitectura cliente-servidor clásica con separación clara entre frontend y backend, comunicados a través de una API REST.

```
┌─────────────────────────────────────────────────────────┐
│                        Cliente                          │
│              Next.js 14 (puerto 3001)                   │
│   React 18 · TanStack Query · React Hook Form · Zod     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────┐
│                       Backend                           │
│              NestJS 10 (puerto 3000)                    │
│   JWT Auth · Throttler · Swagger · class-validator      │
└──────┬──────────────────────────────────────┬───────────┘
       │ Prisma ORM                            │ AWS SDK
┌──────▼──────┐   ┌──────────┐   ┌────────────▼─────────┐
│ PostgreSQL  │   │  Redis   │   │  AWS (SQS / S3 / SES) │
│  (puerto    │   │ (puerto  │   │  (producción)         │
│   5432)     │   │  6379)   │   └──────────────────────┘
└─────────────┘   └──────────┘
```

## Módulos del Backend

| Módulo | Ruta | Responsabilidad |
|--------|------|-----------------|
| `AuthModule` | `/api/auth` | Registro, login, JWT, refresh tokens, logout |
| `ClientsModule` | `/api/clients` | CRUD de contactos de clientes |
| `QuotesModule` | `/api/quotes` | CRUD de cotizaciones, transiciones de estado, límites del plan FREE |
| `QuoteItemsModule` | `/api/quotes/:id/items` | Gestión de líneas de cotización y cálculo de totales |
| `PublicModule` | `/api/public` | Vista pública de cotizaciones, aceptar/rechazar/firmar |
| `TrackingModule` | interno | Registro de eventos de seguimiento |
| `TemplatesModule` | `/api/templates` | Plantillas reutilizables de cotizaciones |
| `DashboardModule` | `/api/dashboard` | Métricas y analíticas del usuario |
| `PrismaModule` | interno | Conexión y servicio de base de datos |

## Seguridad

- Autenticación JWT con tokens de acceso de corta duración (15 min) y refresh tokens (7 días)
- Hash de contraseñas con bcrypt (12 rondas)
- Almacenamiento del hash del refresh token (previene reutilización)
- Headers de seguridad con Helmet
- CORS con lista blanca
- Rate limiting global: 20 req/seg, 300 req/min
- Límite de tamaño de request: 1 MB
- Validación de entrada con class-validator
- Soft deletes para auditoría
- Registro de IP y user-agent en firmas

## Rate Limiting por Ruta

| Ruta | Límite corto | Límite largo |
|------|-------------|-------------|
| `GET /public/quotes/:id` | 10 req/min | 60 req/min |
| `POST /public/quotes/:id/accept` | 3 req/min | 10 req/min |
| `POST /public/quotes/:id/reject` | 3 req/min | 10 req/min |
| `POST /public/track` | 5 req/seg | 100 req/min |
| Global | 20 req/seg | 300 req/min |
