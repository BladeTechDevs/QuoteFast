# SPEC 3 — Backend Implementation

## 1. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  FREE
  PRO
  TEAM
  BUSINESS
}

enum QuoteStatus {
  DRAFT
  SENT
  VIEWED
  ACCEPTED
  REJECTED
  EXPIRED
}

enum TrackingEventType {
  QUOTE_OPENED
  QUOTE_VIEWED
  QUOTE_ACCEPTED
  QUOTE_REJECTED
  QUOTE_PDF_DOWNLOADED
  QUOTE_LINK_COPIED
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  company       String?
  plan          Plan      @default(FREE)
  refreshToken  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  quotes    Quote[]
  clients   Client[]
  templates Template[]

  @@map("users")
}

model Client {
  id        String   @id @default(cuid())
  userId    String
  name      String
  email     String
  company   String?
  phone     String?
  address   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  quotes Quote[]

  @@index([userId])
  @@map("clients")
}

model Quote {
  id          String      @id @default(cuid())
  publicId    String      @unique @default(cuid())
  userId      String
  clientId    String?
  title       String
  status      QuoteStatus @default(DRAFT)
  currency    String      @default("USD")
  subtotal    Decimal     @default(0) @db.Decimal(12, 2)
  taxRate     Decimal     @default(0) @db.Decimal(5, 2)
  taxAmount   Decimal     @default(0) @db.Decimal(12, 2)
  total       Decimal     @default(0) @db.Decimal(12, 2)
  discount    Decimal     @default(0) @db.Decimal(12, 2)
  notes       String?
  terms       String?
  validUntil  DateTime?
  pdfUrl      String?
  sentAt      DateTime?
  viewedAt    DateTime?
  acceptedAt  DateTime?
  rejectedAt  DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  client         Client?         @relation(fields: [clientId], references: [id], onDelete: SetNull)
  items          QuoteItem[]
  trackingEvents TrackingEvent[]

  @@index([userId])
  @@index([status])
  @@index([publicId])
  @@map("quotes")
}

model QuoteItem {
  id          String  @id @default(cuid())
  quoteId     String
  name        String
  description String?
  quantity    Decimal @default(1) @db.Decimal(10, 2)
  unitPrice   Decimal @db.Decimal(12, 2)
  total       Decimal @db.Decimal(12, 2)
  order       Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quote Quote @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@index([quoteId])
  @@map("quote_items")
}

model TrackingEvent {
  id        String            @id @default(cuid())
  quoteId   String
  eventType TrackingEventType
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime          @default(now())

  quote Quote @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@index([quoteId])
  @@index([createdAt])
  @@map("tracking_events")
}

model Template {
  id        String   @id @default(cuid())
  userId    String
  name      String
  content   Json
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("templates")
}
```

---

## 2. Folder Structure

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── plan.guard.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── dto/
│       └── pagination.dto.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── login.dto.ts
│   │       └── auth-response.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │       └── update-user.dto.ts
│   ├── clients/
│   │   ├── clients.module.ts
│   │   ├── clients.controller.ts
│   │   ├── clients.service.ts
│   │   └── dto/
│   │       ├── create-client.dto.ts
│   │       └── update-client.dto.ts
│   ├── quotes/
│   │   ├── quotes.module.ts
│   │   ├── quotes.controller.ts
│   │   ├── quotes.service.ts
│   │   ├── quote-items.controller.ts
│   │   ├── quote-items.service.ts
│   │   └── dto/
│   │       ├── create-quote.dto.ts
│   │       ├── update-quote.dto.ts
│   │       ├── create-quote-item.dto.ts
│   │       ├── update-quote-item.dto.ts
│   │       └── quote-filters.dto.ts
│   ├── templates/
│   │   ├── templates.module.ts
│   │   ├── templates.controller.ts
│   │   ├── templates.service.ts
│   │   └── dto/
│   │       ├── create-template.dto.ts
│   │       └── update-template.dto.ts
│   ├── pdf/
│   │   ├── pdf.module.ts
│   │   └── pdf.service.ts
│   ├── email/
│   │   ├── email.module.ts
│   │   └── email.service.ts
│   ├── tracking/
│   │   ├── tracking.module.ts
│   │   ├── tracking.controller.ts
│   │   └── tracking.service.ts
│   └── public/
│       ├── public.module.ts
│       └── public.controller.ts
├── prisma/
│   └── prisma.service.ts
└── config/
    ├── app.config.ts
    └── aws.config.ts
```

---

## 3. Controllers, Services y Endpoints Detallados

### Auth Controller

```typescript
// POST /api/auth/register
// Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Juan Pérez",
  "company": "Mi Agencia"  // opcional
}
// Response (201):
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "Juan Pérez",
    "plan": "FREE"
  }
}

// POST /api/auth/login
// Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
// Response (200): mismo formato que register
```

### Quotes Controller

```typescript
// POST /api/quotes
// Request:
{
  "title": "Propuesta de Rediseño Web",
  "clientId": "clx...",        // opcional
  "currency": "USD",
  "taxRate": 16,
  "validUntil": "2026-04-24",
  "notes": "Incluye 2 rondas de revisión",
  "terms": "50% anticipo, 50% al entregar",
  "items": [
    {
      "name": "Diseño UI/UX",
      "description": "Diseño de 5 pantallas principales",
      "quantity": 1,
      "unitPrice": 2500
    },
    {
      "name": "Desarrollo Frontend",
      "description": "Implementación en Next.js",
      "quantity": 1,
      "unitPrice": 4000
    }
  ]
}
// Response (201):
{
  "id": "clx...",
  "publicId": "abc123xyz",
  "title": "Propuesta de Rediseño Web",
  "status": "DRAFT",
  "subtotal": 6500,
  "taxRate": 16,
  "taxAmount": 1040,
  "total": 7540,
  "items": [...],
  "client": { "id": "...", "name": "...", "email": "..." },
  "createdAt": "2026-03-24T..."
}

// GET /api/quotes?status=SENT&page=1&limit=10
// Response (200):
{
  "data": [...],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}

// POST /api/quotes/:id/send
// Request:
{
  "recipientEmail": "cliente@empresa.com",  // opcional, usa client.email si no se envía
  "message": "Hola, adjunto la cotización..."  // opcional
}
// Response (200):
{
  "id": "clx...",
  "status": "SENT",
  "sentAt": "2026-03-24T...",
  "publicUrl": "https://app.quotefast.io/q/abc123xyz"
}
```

### Public Controller (sin auth)

```typescript
// GET /api/public/quotes/:publicId
// Response (200):
{
  "title": "Propuesta de Rediseño Web",
  "company": "Mi Agencia",
  "userName": "Juan Pérez",
  "status": "SENT",
  "items": [...],
  "subtotal": 6500,
  "taxAmount": 1040,
  "total": 7540,
  "currency": "USD",
  "validUntil": "2026-04-24",
  "notes": "...",
  "terms": "..."
}
// Nota: NO expone userId, email del usuario, ni datos sensibles

// POST /api/public/quotes/:publicId/accept
// Response (200):
{
  "status": "ACCEPTED",
  "acceptedAt": "2026-03-24T..."
}

// POST /api/public/track
// Request:
{
  "quoteId": "abc123xyz",  // publicId
  "eventType": "QUOTE_OPENED",
  "metadata": {
    "referrer": "email",
    "screenWidth": 1920
  }
}
// Response (201): { "tracked": true }
```

---

## 4. Validation Rules

```typescript
// register.dto.ts
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;
}

// create-quote.dto.ts
export class CreateQuoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;  // ISO 4217

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items?: CreateQuoteItemDto[];
}

// create-quote-item.dto.ts
export class CreateQuoteItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}
```

---

## 5. Tracking System

### Flujo de Tracking

```
Cliente abre link público
    │
    ▼
Frontend (Next.js) carga la cotización
    │
    ├── Al cargar: POST /api/public/track { eventType: "QUOTE_OPENED" }
    │
    ├── Cada 30 seg activo: POST /api/public/track { eventType: "QUOTE_VIEWED", metadata: { duration: 30 } }
    │
    ├── Al descargar PDF: POST /api/public/track { eventType: "QUOTE_PDF_DOWNLOADED" }
    │
    └── Al aceptar/rechazar: Se registra automáticamente
```

### Tracking Service

```typescript
@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private sqsService: SqsService,
  ) {}

  async track(dto: CreateTrackingEventDto, req: Request) {
    // Para MVP: inserción directa
    // Para escala: enviar a SQS para batch processing
    const event = await this.prisma.trackingEvent.create({
      data: {
        quoteId: dto.quoteId,
        eventType: dto.eventType,
        metadata: dto.metadata || {},
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Si es primera apertura, actualizar quote.viewedAt
    if (dto.eventType === 'QUOTE_OPENED') {
      await this.prisma.quote.updateMany({
        where: {
          publicId: dto.quoteId,
          viewedAt: null,
        },
        data: { viewedAt: new Date() },
      });
    }

    return event;
  }

  async getQuoteEvents(quoteId: string) {
    return this.prisma.trackingEvent.findMany({
      where: { quoteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuoteAnalytics(quoteId: string) {
    const events = await this.prisma.trackingEvent.findMany({
      where: { quoteId },
    });

    return {
      totalViews: events.filter(e => e.eventType === 'QUOTE_OPENED').length,
      uniqueViews: new Set(events.filter(e => e.eventType === 'QUOTE_OPENED').map(e => e.ipAddress)).size,
      totalViewTime: events
        .filter(e => e.eventType === 'QUOTE_VIEWED')
        .reduce((sum, e) => sum + ((e.metadata as any)?.duration || 0), 0),
      pdfDownloads: events.filter(e => e.eventType === 'QUOTE_PDF_DOWNLOADED').length,
      firstViewedAt: events.find(e => e.eventType === 'QUOTE_OPENED')?.createdAt,
      lastViewedAt: events.filter(e => e.eventType === 'QUOTE_OPENED').pop()?.createdAt,
    };
  }
}
```

---

## 6. Mejoras de Performance Sugeridas

1. **Cálculos de totales:** Usar un trigger de Prisma middleware o un método `recalculateTotals()` que se ejecute al crear/actualizar/eliminar items. No calcular en cada GET.

2. **Paginación:** Cursor-based pagination para listas grandes (más eficiente que offset).

3. **Cache:** Redis para cotizaciones públicas (se leen mucho más de lo que se escriben). TTL de 5 minutos.

4. **Batch tracking:** En producción, acumular eventos de tracking en el frontend y enviar en batch cada 30 segundos en vez de uno por uno.

5. **Índices parciales:** `CREATE INDEX idx_quotes_active ON quotes(userId) WHERE status NOT IN ('EXPIRED', 'REJECTED')` para queries del dashboard.

6. **Connection pooling:** Usar PgBouncer frente a RDS para manejar más conexiones concurrentes con menos recursos.
