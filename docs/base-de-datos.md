# Base de Datos

Motor: **PostgreSQL 16**
ORM: **Prisma 5**

---

## Diagrama de Relaciones

```
┌─────────────────┐
│      User       │
│─────────────────│
│ id (PK)         │◄──────────────────────────────────┐
│ email (unique)  │                                   │
│ passwordHash    │                                   │
│ name            │                                   │
│ plan            │                                   │
└────────┬────────┘                                   │
         │ 1                                          │
         │                                            │
    ┌────┴──────────────────────────┐                 │
    │                               │                 │
    │ n                             │ n               │ 1
┌───▼─────────┐           ┌────────▼──────┐  ┌───────┴──────────┐
│   Client    │           │    Quote      │  │    Template      │
│─────────────│           │───────────────│  │──────────────────│
│ id (PK)     │◄──────────│ id (PK)       │  │ id (PK)          │
│ userId (FK) │  0..n     │ publicId      │  │ userId (FK)?     │
│ name        │           │ userId (FK)   │  │ name             │
│ email?      │           │ clientId (FK)?│  │ content (JSON)   │
│ company?    │           │ title         │  │ isDefault        │
│ phone?      │           │ status        │  └──────────────────┘
│ address?    │           │ currency      │
│ notes?      │           │ subtotal      │  ┌──────────────────┐
└─────────────┘           │ taxRate       │  │ BrandingSettings │
                          │ taxAmount     │  │──────────────────│
                          │ total         │  │ id (PK)          │
                          │ discount      │◄─│ userId (FK,uniq) │
                          │ validUntil?   │  │ logoUrl?         │
                          │ pdfUrl?       │  │ primaryColor     │
                          │ sentAt?       │  │ accentColor      │
                          │ viewedAt?     │  │ footerText?      │
                          │ acceptedAt?   │  │ companyName?     │
                          │ rejectedAt?   │  └──────────────────┘
                          │ signedAt?     │
                          │ deletedAt?    │
                          └──────┬────────┘
                                 │ 1
                    ┌────────────┼────────────┐
                    │            │            │
                    │ n          │ 0..1       │ n
          ┌─────────▼──┐  ┌─────▼──────┐  ┌─▼────────────┐
          │ QuoteItem  │  │ Signature  │  │TrackingEvent │
          │────────────│  │────────────│  │──────────────│
          │ id (PK)    │  │ id (PK)    │  │ id (PK)      │
          │ quoteId(FK)│  │ quoteId(FK)│  │ quoteId (FK) │
          │ name       │  │ signerName │  │ eventType    │
          │ description│  │ signatureImg│ │ metadata?    │
          │ quantity   │  │ ipAddress? │  │ ipAddress?   │
          │ unitPrice  │  │ userAgent? │  │ userAgent?   │
          │ total      │  │ signedAt   │  │ createdAt    │
          │ order      │  └────────────┘  └──────────────┘
          │ discount   │
          │ taxRate    │
          │ internalCost│
          └────────────┘
```

---

## Descripción de Tablas

### User
Almacena los usuarios registrados en la plataforma. Cada usuario tiene un plan de suscripción que determina sus límites (ej: plan FREE = máx 5 cotizaciones/mes). El `refreshToken` se guarda como hash bcrypt para validar renovaciones de sesión sin exponer el token real.

### Client
Directorio de contactos del usuario. Cada cliente pertenece a un único usuario. No puede eliminarse si tiene cotizaciones asociadas para preservar la integridad referencial.

### Quote
Tabla central del sistema. Representa una cotización en cualquier punto de su ciclo de vida. Tiene dos IDs: `id` (interno, UUID) y `publicId` (expuesto en links públicos). Los campos `*At` registran timestamps de cada transición de estado. El `deletedAt` implementa soft delete para preservar historial.

### QuoteItem
Líneas de detalle de una cotización. Cada ítem tiene su propio cálculo de descuento e impuesto. El campo `internalCost` es solo visible para el usuario emisor, nunca se expone al cliente. Al agregar, editar o eliminar un ítem, los totales de la cotización se recalculan automáticamente.

### Signature
Registro de firma electrónica de una cotización. Relación 1:1 con Quote (una cotización solo puede tener una firma). Almacena la imagen de firma como base64 en texto plano, junto con IP y user-agent del firmante para trazabilidad legal.

### TrackingEvent
Log de todas las interacciones del cliente con una cotización. Cada apertura, aceptación, rechazo o descarga de PDF genera un registro. Incluye IP y user-agent para análisis de comportamiento. El evento `QUOTE_OPENED` tiene lógica especial: si es la primera apertura, actualiza `viewedAt` en la cotización y cambia el estado de `SENT` a `VIEWED`.

### Template
Plantillas reutilizables para pre-llenar cotizaciones. Las plantillas con `userId = null` e `isDefault = true` son del sistema (visibles para todos, no modificables). Las plantillas con `userId` son propias del usuario.

### BrandingSettings
Configuración de identidad visual del usuario. Se aplica automáticamente en la vista pública de todas sus cotizaciones. Relación 1:1 con User. Si no existe configuración, el sistema usa valores por defecto (`primaryColor: #2563eb`).

---

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
