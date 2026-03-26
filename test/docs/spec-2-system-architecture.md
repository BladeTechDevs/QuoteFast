# SPEC 2 — System Architecture

## 1. Arquitectura de Alto Nivel

```
                                    ┌─────────────────┐
                                    │   CloudFront     │
                                    │   (CDN + SSL)    │
                                    └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                     ┌────────▼───────┐ ┌───▼────┐ ┌──────▼──────┐
                     │  Next.js App   │ │  API   │ │ Public Quote│
                     │  (Frontend)    │ │Gateway │ │   Viewer    │
                     │  Vercel/S3     │ │  (ALB) │ │  (Next.js)  │
                     └────────────────┘ └───┬────┘ └─────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   NestJS API    │
                                   │   (ECS Fargate) │
                                   │                 │
                                   │ ┌─────────────┐ │
                                   │ │ Auth Module  │ │
                                   │ │ Quote Module │ │
                                   │ │ Client Module│ │
                                   │ │ Track Module │ │
                                   │ │ Email Module │ │
                                   │ │ PDF Module   │ │
                                   │ └─────────────┘ │
                                   └──┬─────┬─────┬──┘
                                      │     │     │
                          ┌───────────┘     │     └───────────┐
                          │                 │                 │
                 ┌────────▼──────┐ ┌───────▼───────┐ ┌──────▼──────┐
                 │  PostgreSQL   │ │     SQS       │ │     S3      │
                 │  (RDS)       │ │  (Job Queue)  │ │ (PDF Store) │
                 └──────────────┘ └───────┬───────┘ └─────────────┘
                                          │
                                 ┌────────▼────────┐
                                 │  Lambda Workers  │
                                 │                  │
                                 │ • PDF Generation │
                                 │ • Email Sending  │
                                 │ • Tracking Proc. │
                                 └──────────────────┘
```

---

## 2. Servicios y Módulos

### Backend (NestJS) — Módulos

| Módulo | Responsabilidad |
|--------|----------------|
| `AuthModule` | Registro, login, JWT, refresh tokens, password reset |
| `UserModule` | Perfil de usuario, configuración de cuenta |
| `QuoteModule` | CRUD de cotizaciones, items, cálculos, estados |
| `ClientModule` | CRUD de clientes (contactos a quienes se envían cotizaciones) |
| `TemplateModule` | Plantillas de cotización reutilizables |
| `PdfModule` | Generación de PDF (delega a SQS → Lambda) |
| `EmailModule` | Envío de emails (delega a SQS → Lambda con SES) |
| `TrackingModule` | Registro de eventos (apertura, lectura, aceptación) |
| `PublicModule` | Endpoints públicos (vista de cotización, tracking pixel, aceptar/rechazar) |

### Workers (Lambda)

| Worker | Trigger | Acción |
|--------|---------|--------|
| `pdf-generator` | SQS: `pdf-generation-queue` | Genera PDF con Puppeteer/Chromium, sube a S3 |
| `email-sender` | SQS: `email-queue` | Envía email via SES con link a cotización |
| `tracking-processor` | SQS: `tracking-queue` | Procesa eventos de tracking en batch |

---

## 3. Data Flow: Cotización Completa

```
1. Usuario crea cotización (POST /api/quotes)
   → API valida y guarda en PostgreSQL (status: draft)

2. Usuario envía cotización (POST /api/quotes/:id/send)
   → API actualiza status a "sent"
   → Publica mensaje en SQS: pdf-generation-queue
   → Publica mensaje en SQS: email-queue

3. Lambda pdf-generator:
   → Consume mensaje de SQS
   → Renderiza HTML de la cotización
   → Genera PDF con Puppeteer
   → Sube PDF a S3 (quotes/{quoteId}/quote.pdf)
   → Actualiza registro en DB (pdfUrl)

4. Lambda email-sender:
   → Consume mensaje de SQS
   → Espera a que PDF esté listo (o usa link público)
   → Envía email via SES con link público + PDF adjunto
   → Registra evento de envío

5. Cliente abre link público (GET /q/:publicId)
   → Next.js renderiza cotización
   → Dispara evento de tracking (POST /api/public/track)
   → API registra: quote_opened, timestamp, IP, user-agent

6. Cliente acepta (POST /api/public/quotes/:publicId/accept)
   → API actualiza status a "accepted"
   → Notifica al usuario (email + in-app)
```

---

## 4. Manejo de Jobs Asíncronos

### Arquitectura de Colas

```
NestJS API
    │
    ├── SQS: pdf-generation-queue ──→ Lambda: pdf-generator
    │       { quoteId, templateId }       → Puppeteer → S3
    │
    ├── SQS: email-queue ──→ Lambda: email-sender
    │       { quoteId, recipientEmail }   → SES
    │
    └── SQS: tracking-queue ──→ Lambda: tracking-processor
            { event, quoteId, metadata }  → PostgreSQL (batch insert)
```

**¿Por qué SQS + Lambda y no procesamiento directo?**
- Desacopla la API del trabajo pesado (PDF toma 2-5 seg)
- Lambda escala automáticamente con la demanda
- Si falla, SQS reintenta (DLQ para fallos permanentes)
- Costo: solo pagas por ejecución (ideal para MVP)

### Dead Letter Queue (DLQ)
- Cada cola tiene una DLQ asociada
- Después de 3 reintentos fallidos → mensaje va a DLQ
- Alarma en CloudWatch cuando DLQ tiene mensajes

---

## 5. Estructura de Base de Datos (Alto Nivel)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   clients    │     │  templates   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ email        │◄────│ userId (FK)  │     │ userId (FK)  │
│ password     │     │ name         │     │ name         │
│ name         │     │ email        │     │ content      │
│ company      │     │ company      │     │ isDefault    │
│ plan         │     │ phone        │     │ createdAt    │
│ createdAt    │     │ createdAt    │     └──────────────┘
└──────┬───────┘     └──────────────┘
       │
       │ 1:N
       │
┌──────▼───────┐     ┌──────────────┐     ┌──────────────┐
│    quotes    │     │ quote_items  │     │   tracking   │
├──────────────┤     ├──────────────┤     │   _events    │
│ id (PK)      │     │ id (PK)      │     ├──────────────┤
│ userId (FK)  │     │ quoteId (FK) │     │ id (PK)      │
│ clientId (FK)│     │ name         │     │ quoteId (FK) │
│ publicId     │1:N  │ description  │     │ eventType    │
│ title        │────►│ quantity     │     │ metadata     │
│ status       │     │ unitPrice    │     │ ipAddress    │
│ subtotal     │     │ order        │     │ userAgent    │
│ tax          │     │ createdAt    │     │ createdAt    │
│ total        │     └──────────────┘     └──────────────┘
│ currency     │              ▲
│ validUntil   │              │
│ notes        │     ┌────────┴───────┐
│ terms        │     │  (calculado    │
│ pdfUrl       │     │   en backend)  │
│ sentAt       │     └────────────────┘
│ viewedAt     │
│ acceptedAt   │
│ rejectedAt   │
│ createdAt    │
│ updatedAt    │
└──────────────┘
```

**Índices clave:**
- `quotes.publicId` — UNIQUE, para links públicos
- `quotes.userId` — Para queries del dashboard
- `quotes.status` — Para filtros
- `tracking_events.quoteId` — Para analytics
- `tracking_events.createdAt` — Para queries temporales

---

## 6. Estructura de API

### Auth
```
POST   /api/auth/register        → Registro
POST   /api/auth/login           → Login (retorna JWT)
POST   /api/auth/refresh         → Refresh token
POST   /api/auth/forgot-password → Solicitar reset
POST   /api/auth/reset-password  → Resetear password
```

### Users
```
GET    /api/users/me             → Perfil del usuario
PATCH  /api/users/me             → Actualizar perfil
```

### Clients
```
GET    /api/clients              → Listar clientes
POST   /api/clients              → Crear cliente
GET    /api/clients/:id          → Detalle de cliente
PATCH  /api/clients/:id          → Actualizar cliente
DELETE /api/clients/:id          → Eliminar cliente
```

### Quotes
```
GET    /api/quotes               → Listar cotizaciones (con filtros)
POST   /api/quotes               → Crear cotización
GET    /api/quotes/:id           → Detalle de cotización
PATCH  /api/quotes/:id           → Actualizar cotización
DELETE /api/quotes/:id           → Eliminar cotización
POST   /api/quotes/:id/send      → Enviar cotización
POST   /api/quotes/:id/duplicate → Duplicar cotización
GET    /api/quotes/:id/pdf       → Descargar PDF
GET    /api/quotes/:id/tracking  → Ver eventos de tracking
```

### Quote Items
```
POST   /api/quotes/:id/items     → Agregar item
PATCH  /api/quotes/:id/items/:itemId → Actualizar item
DELETE /api/quotes/:id/items/:itemId → Eliminar item
PATCH  /api/quotes/:id/items/reorder → Reordenar items
```

### Public (sin auth)
```
GET    /api/public/quotes/:publicId          → Ver cotización pública
POST   /api/public/quotes/:publicId/accept   → Aceptar cotización
POST   /api/public/quotes/:publicId/reject   → Rechazar cotización
POST   /api/public/track                     → Registrar evento de tracking
```

### Templates
```
GET    /api/templates            → Listar plantillas
POST   /api/templates            → Crear plantilla
PATCH  /api/templates/:id        → Actualizar plantilla
DELETE /api/templates/:id        → Eliminar plantilla
```

---

## 7. Estrategia de Escalamiento

### Fase 1: MVP (0-1K usuarios)
- ECS Fargate: 1 task (0.5 vCPU, 1GB RAM)
- RDS: db.t3.micro (free tier)
- Lambda: dentro de free tier
- Costo estimado: ~$30-50/mes

### Fase 2: Crecimiento (1K-10K usuarios)
- ECS: Auto-scaling (2-4 tasks)
- RDS: db.t3.small con read replica
- ElastiCache (Redis) para sesiones y cache
- CloudFront para assets estáticos
- Costo estimado: ~$150-300/mes

### Fase 3: Escala (10K+ usuarios)
- ECS: Auto-scaling (4-8 tasks)
- RDS: db.r6g.large con multi-AZ
- Redis cluster
- Separar tracking a DynamoDB (write-heavy)
- Costo estimado: ~$500-1000/mes

---

## 8. Decisiones Técnicas y Justificaciones

| Decisión | Justificación |
|----------|---------------|
| NestJS | Estructura modular, TypeScript nativo, decoradores, DI, ideal para SaaS |
| PostgreSQL | Relacional, robusto, JSON support, ideal para datos estructurados de cotizaciones |
| Prisma | Type-safe, migraciones, excelente DX, genera tipos TypeScript |
| ECS Fargate | Sin gestión de servidores, auto-scaling, más predecible que Lambda para API |
| Lambda para workers | Pay-per-use, escala automáticamente, ideal para jobs esporádicos |
| SQS | Desacoplamiento, reintentos automáticos, DLQ, bajo costo |
| S3 para PDFs | Almacenamiento ilimitado, bajo costo, integración nativa con CloudFront |
| JWT | Stateless, escalable, estándar de la industria |
| Next.js | SSR para SEO (landing), CSR para app, mismo stack TypeScript |
