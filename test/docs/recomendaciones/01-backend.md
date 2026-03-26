# Recomendaciones — Backend (NestJS + Prisma)

## 1. Soft Delete en Cotizaciones 🔴 Crítico

Actualmente `remove()` hace un `DELETE` permanente. Si un usuario borra una cotización por error, no hay forma de recuperarla.

**Cambio en schema:**
```prisma
model Quote {
  // ... campos existentes
  deletedAt DateTime?

  @@index([deletedAt])
}
```

**Cambio en servicio:**
```typescript
// En lugar de:
await this.prisma.quote.delete({ where: { id } });

// Usar:
await this.prisma.quote.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// Y en todos los findMany/findFirst, agregar:
where: { userId, deletedAt: null }
```

---

## 2. Rate Limiting en Endpoints Públicos 🔴 Crítico

Los endpoints `/api/public/*` no tienen protección contra abuso. Un bot puede spamear eventos de tracking o hacer scraping de cotizaciones.

**Instalar:**
```bash
npm install @nestjs/throttler
```

**Configurar en `app.module.ts`:**
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },   // 5 req/seg
      { name: 'long',  ttl: 60000, limit: 100 }, // 100 req/min
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```

**Límites más estrictos en endpoints públicos:**
```typescript
@Throttle({ short: { limit: 2, ttl: 1000 } })
@Post('track')
async track() { ... }
```

---

## 3. Versionamiento de Cotizaciones 🟡 Importante

Cuando se edita una cotización ya enviada, se sobreescribe el historial. El cliente puede haber visto una versión diferente a la que está guardada.

**Cambio en schema:**
```prisma
model Quote {
  // ... campos existentes
  version  Int     @default(1)
  parentId String? // referencia a la versión anterior

  parent   Quote?  @relation("QuoteVersions", fields: [parentId], references: [id])
  versions Quote[] @relation("QuoteVersions")
}
```

**Lógica sugerida:**
- Si el status es `DRAFT` → edición directa (sin versión nueva)
- Si el status es `SENT`, `VIEWED` o superior → crear nueva versión (clonar + incrementar `version`)

---

## 4. Audit Logging 🟡 Importante

No hay registro de quién hizo qué y cuándo. Esto es crítico para debugging, soporte al cliente y compliance.

**Nuevo modelo en Prisma:**
```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String   // QUOTE_CREATED, QUOTE_SENT, CLIENT_DELETED, etc.
  entity    String   // quote, client, template
  entityId  String
  metadata  Json?    // snapshot del estado anterior/nuevo
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

**Implementar como interceptor NestJS** para no contaminar los servicios con lógica de auditoría.

---

## 5. Recálculo Automático de Totales 🟡 Importante

Los campos `subtotal`, `taxAmount` y `total` en la tabla `quotes` pueden quedar desincronizados si se agregan/editan/eliminan items sin recalcular.

**Solución: Prisma middleware o método dedicado:**
```typescript
// En prisma.service.ts o en un middleware
async recalculateTotals(quoteId: string) {
  const items = await this.prisma.quoteItem.findMany({ where: { quoteId } });
  const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });

  const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
  const taxAmount = subtotal * (Number(quote.taxRate) / 100);
  const total = subtotal + taxAmount - Number(quote.discount);

  return this.prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, taxAmount, total },
  });
}
```

Llamar a `recalculateTotals()` en `QuoteItemsService` después de cada create/update/delete.

---

## 6. Paginación por Cursor 🟡 Importante

La paginación por offset (`skip`/`take`) es ineficiente con tablas grandes. Con 10K+ cotizaciones, las queries se vuelven lentas.

**Cambio en `findAll`:**
```typescript
// Antes (offset):
skip: (page - 1) * limit,
take: limit,

// Después (cursor):
cursor: cursor ? { id: cursor } : undefined,
take: limit + 1, // pedir uno más para saber si hay siguiente página
```

**Response:**
```typescript
return {
  data: data.slice(0, limit),
  nextCursor: data.length > limit ? data[limit].id : null,
};
```

---

## 7. Swagger / OpenAPI 🟡 Importante

No hay documentación de la API. Esto dificulta el onboarding de nuevos devs y la integración con terceros.

**Instalar:**
```bash
npm install @nestjs/swagger
```

**Configurar en `main.ts`:**
```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('QuoteFast API')
  .setDescription('API para gestión de cotizaciones profesionales')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Agregar decoradores `@ApiProperty()`, `@ApiOperation()`, `@ApiResponse()` en DTOs y controllers.

---

## 8. Validación de Variables de Entorno 🟡 Importante

Si falta una variable de entorno crítica (como `JWT_SECRET`), la app arranca sin error y falla en runtime de forma confusa.

**Instalar:**
```bash
npm install @nestjs/config joi
```

**Configurar validación:**
```typescript
ConfigModule.forRoot({
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  }),
  validationOptions: { abortEarly: false },
})
```

---

## 9. Compresión de Respuestas 🟢 Nice to have

Las respuestas JSON no están comprimidas. Con listas grandes de cotizaciones, esto impacta el tiempo de carga.

```bash
npm install compression
```

```typescript
// main.ts
import * as compression from 'compression';
app.use(compression());
```

---

## 10. Connection Pooling con PgBouncer 🟢 Nice to have

Prisma abre una conexión por instancia. Con múltiples tasks de ECS, se pueden agotar las conexiones de RDS.

**Opciones:**
- Usar `pgbouncer` como sidecar en ECS
- Usar Prisma Accelerate (servicio gestionado de Prisma)
- Configurar `connection_limit` en la URL de Prisma: `?connection_limit=5&pool_timeout=10`
