# Base de Datos

Motor: PostgreSQL 16. ORM: Prisma 5.

## Diagrama de Entidades

```
User ──────────┬──── Quote ────┬──── QuoteItem
               │               ├──── Signature
               ├──── Client ───┘     (1:1)
               │               └──── TrackingEvent
               └──── Template
```

## Modelos

### User

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `email` | String (unique) | Email del usuario |
| `passwordHash` | String | Hash bcrypt de la contraseña |
| `name` | String | Nombre completo |
| `company` | String? | Empresa (opcional) |
| `plan` | Plan | FREE / PRO / TEAM / BUSINESS |
| `refreshToken` | String? | Hash del refresh token activo |
| `createdAt` | DateTime | Fecha de creación |
| `updatedAt` | DateTime | Última actualización |

### Client

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `userId` | UUID | FK → User |
| `name` | String | Nombre del cliente |
| `email` | String? | Email |
| `company` | String? | Empresa |
| `phone` | String? | Teléfono |
| `address` | String? | Dirección |
| `notes` | String? | Notas internas |

### Quote

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria interna |
| `publicId` | UUID (unique) | ID público para links de cliente |
| `userId` | UUID | FK → User |
| `clientId` | UUID? | FK → Client (opcional) |
| `title` | String | Título de la cotización |
| `status` | QuoteStatus | Estado actual |
| `currency` | String | Moneda (default: USD) |
| `subtotal` | Decimal(12,2) | Suma de ítems |
| `taxRate` | Decimal(5,2) | Porcentaje de impuesto |
| `taxAmount` | Decimal(12,2) | Monto de impuesto calculado |
| `total` | Decimal(12,2) | Total final |
| `discount` | Decimal(12,2) | Descuento aplicado |
| `notes` | String? | Notas visibles al cliente |
| `terms` | String? | Términos y condiciones |
| `validUntil` | DateTime? | Fecha de vencimiento |
| `pdfUrl` | String? | URL del PDF generado |
| `sentAt` | DateTime? | Cuándo se envió |
| `viewedAt` | DateTime? | Primera visualización |
| `acceptedAt` | DateTime? | Cuándo fue aceptada |
| `rejectedAt` | DateTime? | Cuándo fue rechazada |
| `signedAt` | DateTime? | Cuándo fue firmada |
| `deletedAt` | DateTime? | Soft delete |

### QuoteItem

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `quoteId` | UUID | FK → Quote (cascade delete) |
| `name` | String | Nombre del ítem |
| `description` | String? | Descripción |
| `quantity` | Decimal(10,2) | Cantidad |
| `unitPrice` | Decimal(12,2) | Precio unitario |
| `discount` | Decimal(12,2) | Descuento absoluto por ítem (default 0) |
| `taxRate` | Decimal(5,2) | Porcentaje de impuesto por ítem (default 0) |
| `internalCost` | Decimal(12,2) | Costo interno (margen, nunca expuesto al cliente, default 0) |
| `total` | Decimal(12,2) | Total del ítem post-descuento y post-impuesto |
| `order` | Int | Posición en la lista |

### Signature

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `quoteId` | UUID (unique) | FK → Quote (cascade delete) |
| `signerName` | String(255) | Nombre del firmante |
| `signatureImage` | Text | Imagen en base64 (puede ser vacío si el cliente no dibujó firma) |
| `ipAddress` | String? | IP del firmante |
| `userAgent` | String? | User-agent del navegador |
| `signedAt` | DateTime | Fecha y hora de firma |
| `createdAt` | DateTime | Fecha de creación del registro |
| `updatedAt` | DateTime | Última actualización |

### TrackingEvent

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `quoteId` | UUID | FK → Quote |
| `eventType` | TrackingEventType | Tipo de evento |
| `metadata` | Json? | Datos adicionales |
| `ipAddress` | String? | IP del visitante |
| `userAgent` | String? | User-agent |
| `createdAt` | DateTime | Timestamp del evento |

### Template

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `userId` | UUID? | FK → User (null = plantilla global) |
| `name` | String | Nombre de la plantilla |
| `content` | Json | Valores por defecto (currency, taxRate, notes, terms, etc.) |
| `isDefault` | Boolean | Si es plantilla por defecto |

## Enums

### Plan
```
FREE | PRO | TEAM | BUSINESS
```

### QuoteStatus
```
DRAFT → SENT → VIEWED → ACCEPTED
                      → REJECTED
                      → EXPIRED
```

> Nota: `SIGNED` fue eliminado como estado independiente (migración `20260327`). Las cotizaciones firmadas quedan en estado `ACCEPTED`. La firma se registra en el modelo `Signature` relacionado.

### TrackingEventType
```
QUOTE_OPENED | QUOTE_VIEWED | QUOTE_ACCEPTED | QUOTE_REJECTED
QUOTE_PDF_DOWNLOADED | QUOTE_EXPIRED
```

## Cálculo de Totales

```
itemSubtotal  = quantity × unitPrice
itemNet       = itemSubtotal - item.discount
itemTax       = itemNet × (item.taxRate / 100)
item.total    = itemNet + itemTax

quote.subtotal  = Σ(item.total)
quote.taxAmount = quote.subtotal × (quote.taxRate / 100)
quote.total     = quote.subtotal + quote.taxAmount - quote.discount
```

> Nota: `item.discount` es un descuento absoluto por ítem. `item.taxRate` es el porcentaje de impuesto por ítem. `item.internalCost` es solo para uso interno (margen) y nunca se expone en la API pública.

## Límites del Plan FREE

- Máximo 5 cotizaciones por mes (se verifica en creación y duplicación).
