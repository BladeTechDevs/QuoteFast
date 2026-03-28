# Base de Datos

Motor: **PostgreSQL 16**
ORM: **Prisma 5**

## Modelos

### User
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| email | String (unique) | Email del usuario |
| passwordHash | String | Hash bcrypt |
| name | String | Nombre completo |
| company | String? | Empresa (opcional) |
| plan | Plan | FREE / PRO / TEAM / BUSINESS |
| refreshToken | String? | Token de refresco activo |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Última actualización |

### Client
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → User |
| name | String | Nombre del cliente |
| email | String? | Email |
| company | String? | Empresa |
| phone | String? | Teléfono |
| address | String? | Dirección |
| notes | String? | Notas internas |

### Quote
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK (uso interno) |
| publicId | UUID (unique) | ID público para links |
| userId | UUID | FK → User |
| clientId | UUID? | FK → Client |
| title | String | Título de la cotización |
| status | QuoteStatus | Estado actual |
| currency | String | Moneda (default: USD) |
| subtotal | Decimal(12,2) | Subtotal |
| taxRate | Decimal(5,2) | Tasa de impuesto % |
| taxAmount | Decimal(12,2) | Monto de impuesto |
| total | Decimal(12,2) | Total final |
| discount | Decimal(12,2) | Descuento global |
| notes | String? | Notas para el cliente |
| terms | String? | Términos y condiciones |
| validUntil | DateTime? | Fecha de vencimiento |
| pdfUrl | String? | URL del PDF en S3 |
| sentAt | DateTime? | Cuándo fue enviada |
| viewedAt | DateTime? | Primera vez vista |
| acceptedAt | DateTime? | Cuándo fue aceptada |
| rejectedAt | DateTime? | Cuándo fue rechazada |
| signedAt | DateTime? | Cuándo fue firmada |
| deletedAt | DateTime? | Soft delete |

Índices: `userId`, `status`, `deletedAt`

### QuoteItem
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| quoteId | UUID | FK → Quote (cascade delete) |
| name | String | Nombre del ítem |
| description | String? | Descripción |
| quantity | Decimal(10,2) | Cantidad |
| unitPrice | Decimal(12,2) | Precio unitario |
| total | Decimal(12,2) | Total del ítem |
| order | Int | Orden de visualización |
| discount | Decimal(12,2) | Descuento por ítem |
| taxRate | Decimal(5,2) | Impuesto por ítem |
| internalCost | Decimal(12,2) | Costo interno (no visible al cliente) |

### Signature
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| quoteId | UUID (unique) | FK → Quote (cascade delete) |
| signerName | VarChar(255) | Nombre del firmante |
| signatureImage | Text | Imagen de firma (base64) |
| ipAddress | String? | IP del firmante |
| userAgent | String? | Navegador del firmante |
| signedAt | DateTime | Fecha de firma |

### TrackingEvent
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| quoteId | UUID | FK → Quote |
| eventType | TrackingEventType | Tipo de evento |
| metadata | Json? | Datos adicionales |
| ipAddress | String? | IP del visitante |
| userAgent | String? | Navegador |
| createdAt | DateTime | Fecha del evento |

### Template
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID? | FK → User (null = plantilla global) |
| name | String | Nombre de la plantilla |
| content | Json | Contenido de la plantilla |
| isDefault | Boolean | Si es la plantilla por defecto |

### BrandingSettings
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| userId | UUID (unique) | FK → User |
| logoUrl | String? | URL del logo |
| primaryColor | String? | Color primario (hex) |
| accentColor | String? | Color de acento (hex) |
| footerText | String? | Texto del pie de página |
| companyName | String? | Nombre de la empresa |

## Enums

```
Plan:              FREE | PRO | TEAM | BUSINESS
QuoteStatus:       DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED
TrackingEventType: QUOTE_OPENED | QUOTE_VIEWED | QUOTE_ACCEPTED |
                   QUOTE_REJECTED | QUOTE_PDF_DOWNLOADED | QUOTE_EXPIRED
```

## Migraciones

Las migraciones están en `backend/prisma/migrations/` y se ejecutan con:

```bash
npx prisma migrate dev    # desarrollo (crea nueva migración)
npx prisma migrate deploy # producción (aplica migraciones pendientes)
```

## Seeds

```bash
npm run prisma:seed           # usuario y datos base
npm run prisma:seed-examples  # 6 cotizaciones en todos los estados
```
