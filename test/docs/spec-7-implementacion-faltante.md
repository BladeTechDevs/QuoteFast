# SPEC 7 — Implementación Faltante (MVP Final)

**Fecha:** 25 de marzo de 2026  
**Objetivo:** Completar los últimos detalles para MVP deployable  
**Tiempo estimado:** 3-4 semanas

---

## 1. Hardening Final del Backend

### 1.1 Validación de Variables de Entorno

**Archivo:** `backend/src/app.module.ts`

**Cambio:**
```typescript
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
  validationSchema: Joi.object({
    // Database
    DATABASE_URL: Joi.string().required(),
    
    // JWT
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    
    // AWS
    AWS_REGION: Joi.string().default('us-east-1'),
    SQS_QUEUE_URL: Joi.string().uri().required(),
    S3_BUCKET: Joi.string().required(),
    SES_FROM_EMAIL: Joi.string().email().required(),
    
    // App
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    FRONTEND_URL: Joi.string().uri().required(),
  }),
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
}),
```

**Tiempo:** 30 minutos

---

### 1.2 Índices Adicionales en Base de Datos

**Archivo:** `backend/prisma/schema.prisma`

**Cambios:**
```prisma
model TrackingEvent {
  // ... campos existentes
  
  @@index([quoteId])
  @@index([createdAt])
  @@index([eventType])
  @@map("tracking_events")
}

model QuoteItem {
  // ... campos existentes
  
  @@index([quoteId])
  @@index([order])
  @@map("quote_items")
}

model Client {
  // ... campos existentes
  
  @@index([userId])
  @@index([email])
  @@map("clients")
}
```

**Migración:**
```bash
cd backend
npx prisma migrate dev --name add_performance_indexes
```

**Tiempo:** 1 hora

---

### 1.3 Endpoints Faltantes

#### Endpoint: Ver Tracking de una Cotización

**Archivo:** `backend/src/quotes/quotes.controller.ts`

```typescript
@Get(':id/tracking')
getTracking(@Request() req, @Param('id') id: string) {
  return this.trackingService.getQuoteTracking(req.user.id, id);
}
```

**Archivo:** `backend/src/tracking/tracking.service.ts`

```typescript
async getQuoteTracking(userId: string, quoteId: string) {
  // Verify ownership
  const quote = await this.prisma.quote.findFirst({
    where: { id: quoteId, userId },
  });
  
  if (!quote) {
    throw new NotFoundException('Quote not found');
  }
  
  const events = await this.prisma.trackingEvent.findMany({
    where: { quoteId },
    orderBy: { createdAt: 'desc' },
  });
  
  return {
    events,
    analytics: await this.getQuoteAnalytics(quoteId),
  };
}

async getQuoteAnalytics(quoteId: string) {
  const events = await this.prisma.trackingEvent.findMany({
    where: { quoteId },
  });
  
  const opened = events.filter(e => e.eventType === 'QUOTE_OPENED');
  const viewed = events.filter(e => e.eventType === 'QUOTE_VIEWED');
  const pdfDownloads = events.filter(e => e.eventType === 'QUOTE_PDF_DOWNLOADED');
  
  return {
    totalViews: opened.length,
    uniqueViews: new Set(opened.map(e => e.ipAddress)).size,
    totalViewTime: viewed.reduce((sum, e) => 
      sum + ((e.metadata as any)?.duration || 0), 0),
    pdfDownloads: pdfDownloads.length,
    firstViewedAt: opened[0]?.createdAt,
    lastViewedAt: opened[opened.length - 1]?.createdAt,
  };
}
```

**Tiempo:** 2 horas

---

#### Endpoint: Descargar PDF

**Archivo:** `backend/src/quotes/quotes.controller.ts`

```typescript
@Get(':id/pdf')
async downloadPdf(@Request() req, @Param('id') id: string, @Res() res: Response) {
  const quote = await this.quotesService.findOne(req.user.id, id);
  
  if (!quote.pdfUrl) {
    throw new NotFoundException('PDF not generated yet');
  }
  
  // Redirect to S3 URL or stream from S3
  res.redirect(quote.pdfUrl);
}
```

**Tiempo:** 1 hora

---

### 1.4 Health Checks

**Archivo:** `backend/src/health/health.controller.ts` (nuevo)

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch (error) {
      return { status: 'not_ready', database: 'disconnected' };
    }
  }
}
```

**Archivo:** `backend/src/health/health.module.ts` (nuevo)

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

Agregar a `app.module.ts`:
```typescript
imports: [
  // ... otros imports
  HealthModule,
]
```

**Tiempo:** 1 hora

---

### 1.5 Logging Estructurado

**Instalar:**
```bash
cd backend
npm install winston nest-winston
```

**Archivo:** `backend/src/logger/logger.module.ts` (nuevo)

```typescript
import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      ],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
```

**Tiempo:** 2 horas

---

## 2. Modelo AuditLog

**Archivo:** `backend/prisma/schema.prisma`

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String   // QUOTE_CREATED, QUOTE_SENT, CLIENT_DELETED, etc.
  entity    String   // quote, client, template
  entityId  String
  metadata  Json?    // snapshot del estado anterior/nuevo
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entityId])
  @@index([createdAt])
  @@index([action])
  @@map("audit_logs")
}

model User {
  // ... campos existentes
  auditLogs AuditLog[]
}
```

**Migración:**
```bash
npx prisma migrate dev --name add_audit_log
```

**Interceptor:** `backend/src/common/interceptors/audit.interceptor.ts` (nuevo)

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, body } = request;

    // Solo auditar operaciones de escritura
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (user?.id) {
          await this.logAudit(user.id, method, url, body, response, request);
        }
      }),
    );
  }

  private async logAudit(userId: string, method: string, url: string, body: any, response: any, request: any) {
    const action = this.getAction(method, url);
    const entity = this.getEntity(url);
    const entityId = response?.id || body?.id || this.extractIdFromUrl(url);

    if (action && entity) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId: entityId || 'unknown',
          metadata: { body, response },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
    }
  }

  private getAction(method: string, url: string): string | null {
    if (url.includes('/quotes') && method === 'POST') return 'QUOTE_CREATED';
    if (url.includes('/quotes') && method === 'PATCH') return 'QUOTE_UPDATED';
    if (url.includes('/quotes') && method === 'DELETE') return 'QUOTE_DELETED';
    if (url.includes('/send')) return 'QUOTE_SENT';
    // ... más acciones
    return null;
  }

  private getEntity(url: string): string | null {
    if (url.includes('/quotes')) return 'quote';
    if (url.includes('/clients')) return 'client';
    if (url.includes('/templates')) return 'template';
    return null;
  }

  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/\/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }
}
```

**Tiempo:** 4 horas

---

## 3. Versionamiento de Cotizaciones

**Archivo:** `backend/prisma/schema.prisma`

```prisma
model Quote {
  // ... campos existentes
  version  Int     @default(1)
  parentId String?

  parent   Quote?  @relation("QuoteVersions", fields: [parentId], references: [id], onDelete: SetNull)
  versions Quote[] @relation("QuoteVersions")
}
```

**Migración:**
```bash
npx prisma migrate dev --name add_quote_versioning
```

**Lógica en servicio:** `backend/src/quotes/quotes.service.ts`

```typescript
async update(userId: string, id: string, dto: UpdateQuoteDto) {
  const quote = await this.findOne(userId, id);

  // Si la cotización ya fue enviada, crear nueva versión
  if (['SENT', 'VIEWED', 'ACCEPTED'].includes(quote.status)) {
    return this.createNewVersion(userId, id, dto);
  }

  // Si es DRAFT, actualizar directamente
  return this.prisma.quote.update({
    where: { id },
    data: dto,
  });
}

private async createNewVersion(userId: string, parentId: string, dto: UpdateQuoteDto) {
  const parent = await this.findOne(userId, parentId);

  const newVersion = await this.prisma.quote.create({
    data: {
      ...dto,
      userId,
      parentId,
      version: parent.version + 1,
      status: 'DRAFT',
      publicId: uuid(),
      sentAt: null,
      viewedAt: null,
      acceptedAt: null,
      rejectedAt: null,
    },
  });

  // Copiar items
  const items = await this.prisma.quoteItem.findMany({
    where: { quoteId: parentId },
  });

  for (const item of items) {
    await this.prisma.quoteItem.create({
      data: {
        quoteId: newVersion.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        order: item.order,
      },
    });
  }

  return newVersion;
}
```

**Tiempo:** 6 horas

---

## 4. Funcionalidades de Producto

### 4.1 Onboarding

**Archivo:** `backend/prisma/schema.prisma`

```prisma
model User {
  // ... campos existentes
  onboardingCompleted Boolean @default(false)
}
```

**Migración:**
```bash
npx prisma migrate dev --name add_onboarding_flag
```

**Frontend:** `frontend/src/app/(app)/onboarding/page.tsx` (nuevo)

```typescript
'use client';

export default function OnboardingPage() {
  // Implementar wizard de 3 pasos
  // 1. Crear primera cotización
  // 2. Agregar un cliente
  // 3. Personalizar perfil
}
```

**Tiempo:** 1 día

---

### 4.2 Búsqueda Avanzada

**Backend:** `backend/src/quotes/dto/list-quotes.dto.ts`

```typescript
export class ListQuotesDto {
  // ... campos existentes
  
  @IsOptional()
  @IsString()
  search?: string;  // Buscar en título
  
  @IsOptional()
  @IsString()
  clientId?: string;
  
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  
  @IsOptional()
  @IsDateString()
  dateTo?: string;
  
  @IsOptional()
  @IsNumber()
  minTotal?: number;
  
  @IsOptional()
  @IsNumber()
  maxTotal?: number;
}
```

**Servicio:**
```typescript
where: {
  userId,
  deletedAt: null,
  ...(query.search && {
    title: { contains: query.search, mode: 'insensitive' },
  }),
  ...(query.clientId && { clientId: query.clientId }),
  ...(query.dateFrom && { createdAt: { gte: new Date(query.dateFrom) } }),
  ...(query.dateTo && { createdAt: { lte: new Date(query.dateTo) } }),
  ...(query.minTotal && { total: { gte: query.minTotal } }),
  ...(query.maxTotal && { total: { lte: query.maxTotal } }),
}
```

**Frontend:** Agregar filtros en `/quotes`

**Tiempo:** 1 día

---

### 4.3 Notificaciones por Email

**Worker:** `workers/src/notification-worker.ts` (nuevo)

```typescript
// Enviar email al usuario cuando cliente abre/acepta cotización
```

**Trigger:** En `tracking.service.ts`

```typescript
if (dto.eventType === 'QUOTE_OPENED' && !quote.viewedAt) {
  await this.sqsService.enqueue({
    type: 'SEND_NOTIFICATION',
    quoteId: quote.id,
    userId: quote.userId,
    event: 'QUOTE_OPENED',
  });
}
```

**Tiempo:** 1 día

---

## 5. Testing Completo

### 5.1 Tests de Integración Backend

**Archivo:** `backend/test/quotes.integration.spec.ts` (nuevo)

```typescript
describe('Quotes Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Setup app con DB de test
  });

  it('should create a quote', async () => {
    // Test completo
  });

  // ... más tests
});
```

**Tiempo:** 3 días

---

### 5.2 Tests Frontend

**Instalar:**
```bash
cd frontend
npm install -D @testing-library/react @testing-library/jest-dom vitest jsdom
```

**Archivo:** `frontend/src/components/ui/Button.test.tsx` (nuevo)

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

**Tiempo:** 2 días

---

## 6. Deployment Automatizado

**Archivo:** `.github/workflows/deploy.yml` (nuevo)

```yaml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        # ... build y push a ECR
      - name: Deploy to ECS
        # ... update ECS service

  deploy-lambdas:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Lambda functions
        # ... zip y deploy

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        # ... vercel deploy
```

**Tiempo:** 2 días

---

## 7. Observabilidad

### 7.1 Alarmas en Terraform

**Archivo:** `terraform/modules/monitoring/alarms.tf` (nuevo)

```hcl
resource "aws_cloudwatch_metric_alarm" "api_error_rate" {
  alarm_name          = "quotefast-api-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

**Tiempo:** 1 día

---

## 8. Documentación

### 8.1 README.md

**Archivo:** `README.md` (actualizar)

```markdown
# QuoteFast

## Setup Local

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- AWS CLI (para deployment)

### Quick Start
\`\`\`bash
# Clone repo
git clone ...

# Start services
docker-compose up -d

# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
\`\`\`

## Deployment
...
```

**Tiempo:** 2 horas

---

## Resumen de Tiempo

| Tarea | Tiempo Estimado |
|-------|-----------------|
| Hardening backend | 1 día |
| Modelo AuditLog | 4 horas |
| Versionamiento | 6 horas |
| Onboarding | 1 día |
| Búsqueda avanzada | 1 día |
| Notificaciones | 1 día |
| Tests backend | 3 días |
| Tests frontend | 2 días |
| Deployment | 2 días |
| Observabilidad | 1 día |
| Documentación | 2 horas |
| **TOTAL** | **~3 semanas** |

Con un equipo de 2-3 personas: **1-2 semanas**
