# Arquitectura General

## Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTE                                 │
│                    Next.js 14 (App Router)                       │
│                    Puerto 3000 (local)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / REST (Axios + JWT)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API BACKEND                                │
│                  NestJS 10 + TypeScript                          │
│                    Puerto 3001 (local)                           │
│                                                                  │
│  Auth │ Clients │ Quotes │ QuoteItems │ Templates │ Tracking     │
│  Dashboard │ Branding │ Public (sin auth)                        │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐       ┌──────────────────────┐
│   PostgreSQL 16  │       │      AWS SQS          │
│   (Prisma ORM)   │       │  (cola de trabajos)   │
└──────────────────┘       └──────────┬───────────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
               ┌──────────────────┐   ┌──────────────────┐
               │  Lambda Worker   │   │  Lambda Worker   │
               │  (email-worker)  │   │  (pdf-worker)    │
               │   AWS SES        │   │   AWS S3         │
               └──────────────────┘   └──────────────────┘
```

## Componentes Principales

### Frontend (Next.js 14)
- App Router con rutas protegidas y públicas
- TanStack React Query para estado del servidor
- Axios con interceptores JWT (auto-refresh en 401)
- Tokens almacenados en cookies seguras

### Backend (NestJS)
- API REST con prefijo `/api`
- Autenticación JWT (access + refresh tokens)
- Rate limiting: 20 req/seg, 300 req/min
- Swagger disponible en `/api/docs` (solo en desarrollo)
- Validación global con `class-validator`
- Soft delete en cotizaciones (`deletedAt`)

### Base de Datos (PostgreSQL + Prisma)
- PostgreSQL 16 como motor principal
- Prisma como ORM con migraciones versionadas
- Índices en `userId`, `status`, `deletedAt` en la tabla `Quote`

### Procesamiento Asíncrono
- El backend encola trabajos en AWS SQS
- Lambda workers consumen la cola y procesan:
  - `SEND_QUOTE` / `SEND_EMAIL` → email-worker → AWS SES
  - `SEND_QUOTE` / `GENERATE_PDF` → pdf-worker → AWS S3
- Reintentos con backoff exponencial (0s, 30s, 5min)
- Dead Letter Queue para mensajes fallidos

## Flujo de una Cotización

```
DRAFT → SENT → VIEWED → ACCEPTED
                      ↘ REJECTED
                      ↘ EXPIRED (cron job)
```

1. Usuario crea cotización en estado `DRAFT`
2. Al enviar, el backend encola un job en SQS y cambia estado a `SENT`
3. Lambda genera el PDF y lo sube a S3
4. Lambda envía el email con link público via SES
5. Cliente abre el link `/q/{publicId}` → estado cambia a `VIEWED`
6. Cliente acepta o rechaza → estado cambia a `ACCEPTED` o `REJECTED`
7. Cron job diario marca como `EXPIRED` las cotizaciones vencidas
