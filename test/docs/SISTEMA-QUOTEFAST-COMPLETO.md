# 📘 SISTEMA QUOTEFAST - DOCUMENTACIÓN COMPLETA

## 🎯 Descripción General

QuoteFast es un sistema de gestión de cotizaciones (quotes) diseñado para facilitar la creación, envío, seguimiento y aceptación de cotizaciones comerciales. El sistema permite a los usuarios crear cotizaciones profesionales, enviarlas a clientes mediante enlaces públicos, y realizar seguimiento en tiempo real de su estado.

**Arquitectura:** Backend NestJS + PostgreSQL + Prisma ORM

**Estado Actual:** MVP funcional con firma electrónica implementada

---

## 📊 MODELO DE DATOS

### Entidades Principales

#### User (Usuario)
Representa a los usuarios del sistema que crean y gestionan cotizaciones.

```prisma
model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String
  name         String
  company      String?
  plan         Plan       @default(FREE)
  refreshToken String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

**Planes disponibles:**
- FREE: 5 cotizaciones por mes
- PRO: Cotizaciones ilimitadas
- TEAM: Funcionalidades de equipo (futuro)
- BUSINESS: Funcionalidades empresariales (futuro)

#### Client (Cliente)
Representa a los clientes a quienes se envían las cotizaciones.

```prisma
model Client {
  id        String   @id @default(uuid())
  userId    String
  name      String
  email     String?
  company   String?
  phone     String?
  address   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```


#### Quote (Cotización)
Entidad central del sistema que representa una cotización.

```prisma
model Quote {
  id             String          @id @default(uuid())
  publicId       String          @unique @default(uuid())
  userId         String
  clientId       String?
  title          String
  status         QuoteStatus     @default(DRAFT)
  currency       String          @default("USD")
  subtotal       Decimal         @default(0)
  taxRate        Decimal         @default(0)
  taxAmount      Decimal         @default(0)
  total          Decimal         @default(0)
  discount       Decimal         @default(0)
  notes          String?
  terms          String?
  validUntil     DateTime?
  pdfUrl         String?
  sentAt         DateTime?
  viewedAt       DateTime?
  acceptedAt     DateTime?
  rejectedAt     DateTime?
  signedAt       DateTime?
  deletedAt      DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```

**Estados de Cotización (QuoteStatus):**
- DRAFT: Borrador, en edición
- SENT: Enviada al cliente
- VIEWED: Vista por el cliente
- ACCEPTED: Aceptada por el cliente
- REJECTED: Rechazada por el cliente
- EXPIRED: Expirada (pasó validUntil)
- SIGNED: Firmada digitalmente (nuevo)

#### QuoteItem (Item de Cotización)
Representa cada línea/producto dentro de una cotización.

```prisma
model QuoteItem {
  id          String   @id @default(uuid())
  quoteId     String
  name        String
  description String?
  quantity    Decimal
  unitPrice   Decimal
  total       Decimal
  order       Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Signature (Firma Electrónica) ✨ NUEVO
Almacena las firmas digitales de las cotizaciones.

```prisma
model Signature {
  id             String   @id @default(uuid())
  quoteId        String   @unique
  signerName     String   @db.VarChar(255)
  signatureImage String   @db.Text
  ipAddress      String?
  userAgent      String?
  signedAt       DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

**Características:**
- Una firma por cotización (relación 1:1)
- Imagen almacenada en base64 (máx 5MB)
- Metadata de auditoría (IP, user-agent, timestamp)
- Solo cotizaciones en estado SENT o VIEWED pueden firmarse


#### TrackingEvent (Evento de Seguimiento)
Registra todos los eventos que ocurren en el ciclo de vida de una cotización.

```prisma
model TrackingEvent {
  id        String            @id @default(uuid())
  quoteId   String
  eventType TrackingEventType
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime          @default(now())
}
```

**Tipos de Eventos (TrackingEventType):**
- QUOTE_OPENED: Cliente abrió el enlace público
- QUOTE_VIEWED: Cliente visualizó la cotización
- QUOTE_ACCEPTED: Cliente aceptó la cotización
- QUOTE_REJECTED: Cliente rechazó la cotización
- QUOTE_PDF_DOWNLOADED: Cliente descargó el PDF
- QUOTE_EXPIRED: Cotización expiró automáticamente
- QUOTE_SIGNED: Cliente firmó la cotización ✨ NUEVO

#### Template (Plantilla)
Plantillas predefinidas para crear cotizaciones rápidamente.

```prisma
model Template {
  id        String   @id @default(uuid())
  userId    String?
  name      String
  content   Json
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 🔄 FLUJOS DEL SISTEMA

### 1. Flujo de Autenticación

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ├─► POST /auth/register
       │   • Email, password, name
       │   • Valida email único
       │   • Hash password (bcrypt, 12 rounds)
       │   • Crea usuario con plan FREE
       │   • Genera access token (15min) + refresh token (7d)
       │   • Retorna tokens + datos de usuario
       │
       ├─► POST /auth/login
       │   • Email, password
       │   • Valida credenciales
       │   • Genera nuevos tokens
       │   • Almacena hash de refresh token
       │   • Retorna tokens + datos de usuario
       │
       ├─► POST /auth/refresh
       │   • Refresh token
       │   • Valida token y hash almacenado
       │   • Genera nuevos tokens
       │   • Retorna nuevos tokens
       │
       └─► POST /auth/logout
           • Invalida refresh token
           • Limpia token almacenado en BD
```

**Seguridad:**
- Passwords hasheados con bcrypt (12 rounds)
- Access tokens de corta duración (15 minutos)
- Refresh tokens almacenados hasheados
- JWT con secrets separados para access y refresh


### 2. Flujo de Creación de Cotización

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       ├─► POST /quotes
       │   Headers: Authorization: Bearer {accessToken}
       │   Body: {
       │     title: string
       │     clientId?: string
       │     templateId?: string
       │     currency?: string
       │     taxRate?: number
       │     discount?: number
       │     notes?: string
       │     terms?: string
       │     validUntil?: date
       │   }
       │
       ├─► [QuotesService.create]
       │   │
       │   ├─► Verifica plan del usuario
       │   │   • Si es FREE: valida límite mensual (5 quotes/mes)
       │   │   • Si excede: lanza ForbiddenException
       │   │
       │   ├─► Si templateId presente:
       │   │   • Busca template (propio o default)
       │   │   • Pre-llena campos desde template.content
       │   │
       │   └─► Crea Quote en BD
       │       • Status: DRAFT
       │       • Genera publicId único (UUID)
       │       • Aplica valores por defecto
       │
       └─► Retorna Quote creada
           • Incluye items (vacío inicialmente)
           • Incluye datos de client si existe
```

**Validaciones:**
- Usuario autenticado (JWT guard)
- Límite de plan FREE (5 quotes/mes)
- ClientId debe pertenecer al usuario
- TemplateId debe ser propio o default público


### 3. Flujo de Gestión de Items

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       ├─► POST /quotes/:quoteId/items
       │   Body: {
       │     name: string
       │     description?: string
       │     quantity: number
       │     unitPrice: number
       │   }
       │   │
       │   ├─► [QuoteItemsService.create]
       │   │   • Valida ownership de la quote
       │   │   • Calcula total = quantity * unitPrice
       │   │   • Asigna order automático (último + 1)
       │   │   • Crea QuoteItem
       │   │   • Recalcula totales de Quote
       │   │
       │   └─► Retorna QuoteItem creado
       │
       ├─► PATCH /quotes/:quoteId/items/:itemId
       │   Body: {
       │     name?: string
       │     description?: string
       │     quantity?: number
       │     unitPrice?: number
       │   }
       │   │
       │   ├─► [QuoteItemsService.update]
       │   │   • Valida ownership
       │   │   • Actualiza campos
       │   │   • Recalcula total del item
       │   │   • Recalcula totales de Quote
       │   │
       │   └─► Retorna QuoteItem actualizado
       │
       ├─► DELETE /quotes/:quoteId/items/:itemId
       │   │
       │   ├─► [QuoteItemsService.remove]
       │   │   • Valida ownership
       │   │   • Elimina QuoteItem (hard delete)
       │   │   • Recalcula totales de Quote
       │   │
       │   └─► Retorna 204 No Content
       │
       └─► PATCH /quotes/:quoteId/items/reorder
           Body: { itemIds: string[] }
           │
           ├─► [QuoteItemsService.reorder]
           │   • Valida ownership de todos los items
           │   • Actualiza order según array
           │
           └─► Retorna items reordenados
```

**Cálculo de Totales:**
```typescript
// Por cada item
item.total = item.quantity * item.unitPrice

// Para la quote
quote.subtotal = sum(items.total)
quote.taxAmount = quote.subtotal * (quote.taxRate / 100)
quote.total = quote.subtotal + quote.taxAmount - quote.discount
```


### 4. Flujo de Envío de Cotización

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       ├─► POST /quotes/:id/send
       │   Body: {
       │     recipientEmail: string
       │     message?: string
       │   }
       │   │
       │   ├─► [QuotesSendService.send]
       │   │   │
       │   │   ├─► Valida ownership de la quote
       │   │   │
       │   │   ├─► Valida estado de la quote
       │   │   │   • Debe estar en DRAFT o VIEWED
       │   │   │   • No puede estar EXPIRED, ACCEPTED, REJECTED
       │   │   │
       │   │   ├─► Actualiza Quote
       │   │   │   • status = SENT
       │   │   │   • sentAt = now()
       │   │   │
       │   │   ├─► Encola mensaje en SQS
       │   │   │   {
       │   │   │     quoteId: string
       │   │   │     type: 'SEND_EMAIL'
       │   │   │     recipientEmail: string
       │   │   │     message?: string
       │   │   │     retryCount: 0
       │   │   │   }
       │   │   │
       │   │   └─► Worker procesa cola (asíncrono)
       │   │       • Genera enlace público: /public/quotes/{publicId}
       │   │       • Envía email con enlace
       │   │       • Incluye mensaje personalizado si existe
       │   │       • Retry automático en caso de fallo (max 3)
       │   │
       │   └─► Retorna Quote actualizada
       │
       └─► Cliente recibe email
           • Asunto: "Nueva cotización: {title}"
           • Cuerpo: Mensaje personalizado + enlace público
           • Enlace: https://app.quotefast.com/public/quotes/{publicId}
```

**Estados válidos para envío:**
- DRAFT → SENT ✓
- VIEWED → SENT ✓ (reenvío)
- SENT → SENT ✓ (reenvío)
- ACCEPTED → SENT ✗
- REJECTED → SENT ✗
- EXPIRED → SENT ✗
- SIGNED → SENT ✗


### 5. Flujo de Vista Pública (Cliente)

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ├─► GET /public/quotes/:publicId
       │   • Sin autenticación requerida
       │   • Acceso mediante enlace público
       │   │
       │   ├─► [PublicQuotesService.getQuoteAndTrackOpen]
       │   │   │
       │   │   ├─► Busca Quote por publicId
       │   │   │   • Si no existe: 404 Not Found
       │   │   │
       │   │   ├─► Registra evento QUOTE_OPENED
       │   │   │   • Captura IP del cliente
       │   │   │   • Captura user-agent
       │   │   │   • Crea TrackingEvent
       │   │   │
       │   │   ├─► Si es primera apertura (viewedAt = null):
       │   │   │   • Actualiza viewedAt = now()
       │   │   │   • Si status = SENT: cambia a VIEWED
       │   │   │
       │   │   └─► Retorna datos públicos de Quote
       │   │       {
       │   │         publicId, title, status, currency
       │   │         items: [{ name, description, quantity, unitPrice, total }]
       │   │         subtotal, taxRate, taxAmount, discount, total
       │   │         notes, terms, validUntil, pdfUrl
       │   │         issuer: { name, company }
       │   │         client: { name, company }
       │   │       }
       │   │
       │   └─► Cliente visualiza cotización
       │       • Información del emisor
       │       • Detalles de items
       │       • Totales calculados
       │       • Términos y condiciones
       │       • Fecha de validez
       │
       ├─► POST /public/quotes/:publicId/accept
       │   • Cliente acepta la cotización
       │   │
       │   ├─► [PublicQuotesService.accept]
       │   │   • Valida estado no terminal
       │   │   • Actualiza status = ACCEPTED
       │   │   • Actualiza acceptedAt = now()
       │   │   • Registra evento QUOTE_ACCEPTED
       │   │   • Encola notificación al usuario (SQS)
       │   │
       │   └─► Retorna confirmación
       │
       ├─► POST /public/quotes/:publicId/reject
       │   • Cliente rechaza la cotización
       │   │
       │   ├─► [PublicQuotesService.reject]
       │   │   • Valida estado no terminal
       │   │   • Actualiza status = REJECTED
       │   │   • Actualiza rejectedAt = now()
       │   │   • Registra evento QUOTE_REJECTED
       │   │   • Encola notificación al usuario (SQS)
       │   │
       │   └─► Retorna confirmación
       │
       └─► GET /public/quotes/:publicId/pdf
           • Cliente descarga PDF
           │
           ├─► [PublicQuotesService.trackPdfDownload]
           │   • Registra evento QUOTE_PDF_DOWNLOADED
           │
           └─► Retorna PDF (si existe pdfUrl)
```

**Estados terminales (no permiten accept/reject):**
- ACCEPTED
- REJECTED
- EXPIRED


### 6. Flujo de Firma Electrónica ✨ NUEVO

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       │ Accede a vista pública de cotización
       │ GET /public/quotes/:publicId
       │
       ├─► Si status = SENT o VIEWED:
       │   • Muestra interfaz de firma
       │   • Canvas para dibujar firma
       │   • Campo para nombre del firmante
       │
       └─► POST /public/quotes/:publicId/sign
           Body: {
             signerName: string
             signatureImage: string (base64 data URI)
           }
           │
           ├─► [SignatureService.signQuote]
           │   │
           │   ├─► Extrae metadata del request
           │   │   • ipAddress (request.ip)
           │   │   • userAgent (request.headers['user-agent'])
           │   │
           │   ├─► Busca Quote por publicId
           │   │   • Si no existe: 404 Not Found
           │   │
           │   ├─► Valida estado de Quote
           │   │   • Debe ser SENT o VIEWED
           │   │   • Si es otro estado: 409 Conflict
           │   │
           │   ├─► Valida datos de firma
           │   │   │
           │   │   ├─► Valida signerName:
           │   │   │   • No vacío después de trim
           │   │   │   • Máximo 255 caracteres
           │   │   │   • Si inválido: 400 Bad Request
           │   │   │
           │   │   └─► Valida signatureImage:
           │   │       • Formato: data:image/{type};base64,{data}
           │   │       • Tipos permitidos: png, jpeg, jpg, webp
           │   │       • Tamaño máximo: 5MB (decodificado)
           │   │       • Si inválido: 400 Bad Request
           │   │
           │   ├─► Transacción de BD:
           │   │   │
           │   │   ├─► Si existe firma anterior:
           │   │   │   • Elimina firma anterior (upsert)
           │   │   │
           │   │   ├─► Crea/actualiza Signature
           │   │   │   {
           │   │   │     quoteId: quote.id
           │   │   │     signerName: trimmed name
           │   │   │     signatureImage: base64 string
           │   │   │     ipAddress: client IP
           │   │   │     userAgent: client UA
           │   │   │     signedAt: now()
           │   │   │   }
           │   │   │
           │   │   └─► Actualiza Quote
           │   │       • status = SIGNED
           │   │       • signedAt = now()
           │   │
           │   ├─► Registra evento de tracking
           │   │   • eventType: QUOTE_SIGNED
           │   │   • metadata: { signerName }
           │   │   • ipAddress, userAgent
           │   │
           │   └─► Retorna respuesta
           │       {
           │         id: signature.id
           │         quoteStatus: SIGNED
           │         signedAt: timestamp
           │       }
           │
           └─► Cliente ve confirmación
               • "Cotización firmada exitosamente"
               • Muestra firma capturada
               • Deshabilita botón de firma
```

**Validaciones de Firma:**
- Solo estados SENT o VIEWED pueden firmarse
- Nombre del firmante: 1-255 caracteres (trimmed)
- Imagen: formato base64 data URI válido
- Imagen: tipos permitidos (png, jpeg, jpg, webp)
- Imagen: máximo 5MB decodificado
- Una sola firma activa por cotización (upsert)

**Manejo de Concurrencia:**
- Si múltiples requests simultáneos: solo uno exitoso
- Otros reciben 409 Conflict
- Protección mediante transacción de BD


### 7. Flujo de Tracking y Eventos

```
┌──────────────────────────────────────────────────────────┐
│                    Sistema de Tracking                    │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ├─► QUOTE_OPENED
                        │   • Trigger: Cliente abre enlace público
                        │   • Acción: Registra evento + actualiza viewedAt
                        │   • Si status = SENT: cambia a VIEWED
                        │
                        ├─► QUOTE_VIEWED
                        │   • Trigger: Cliente visualiza cotización completa
                        │   • Acción: Registra evento
                        │
                        ├─► QUOTE_ACCEPTED
                        │   • Trigger: Cliente acepta cotización
                        │   • Acción: Registra evento + notifica usuario
                        │
                        ├─► QUOTE_REJECTED
                        │   • Trigger: Cliente rechaza cotización
                        │   • Acción: Registra evento + notifica usuario
                        │
                        ├─► QUOTE_PDF_DOWNLOADED
                        │   • Trigger: Cliente descarga PDF
                        │   • Acción: Registra evento
                        │
                        ├─► QUOTE_EXPIRED
                        │   • Trigger: Cron job diario (validUntil < now)
                        │   • Acción: Registra evento + cambia status
                        │
                        └─► QUOTE_SIGNED ✨ NUEVO
                            • Trigger: Cliente firma cotización
                            • Acción: Registra evento con metadata
                            • Metadata: { signerName, ipAddress, userAgent }

┌─────────────────────────────────────────────────────────┐
│              TrackingService.registerEvent               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ├─► Crea TrackingEvent en BD
                       │   {
                       │     quoteId: string
                       │     eventType: TrackingEventType
                       │     metadata?: Json
                       │     ipAddress?: string
                       │     userAgent?: string
                       │     createdAt: timestamp
                       │   }
                       │
                       └─► Si eventType = QUOTE_OPENED:
                           • Actualiza viewedAt (solo primera vez)
                           • Si status = SENT: cambia a VIEWED
```

**Propósito del Tracking:**
- Auditoría completa del ciclo de vida
- Visibilidad para el usuario (dashboard)
- Analytics y métricas de conversión
- Evidencia legal de aceptación/firma


### 8. Flujo de Dashboard y Métricas

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       └─► GET /dashboard/metrics
           Headers: Authorization: Bearer {accessToken}
           │
           ├─► [DashboardService.getMetrics]
           │   │
           │   ├─► Calcula métricas del usuario:
           │   │   │
           │   │   ├─► Total de cotizaciones
           │   │   │   • Count de quotes (deletedAt = null)
           │   │   │
           │   │   ├─► Cotizaciones por estado
           │   │   │   • DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, SIGNED
           │   │   │
           │   │   ├─► Tasa de conversión
           │   │   │   • (ACCEPTED + SIGNED) / (SENT + VIEWED + ACCEPTED + REJECTED + SIGNED)
           │   │   │
           │   │   ├─► Valor total de cotizaciones
           │   │   │   • Sum(total) de todas las quotes
           │   │   │
           │   │   ├─► Valor de cotizaciones aceptadas
           │   │   │   • Sum(total) donde status = ACCEPTED o SIGNED
           │   │   │
           │   │   ├─► Cotizaciones recientes
           │   │   │   • Últimas 10 quotes ordenadas por createdAt
           │   │   │
           │   │   └─► Actividad reciente
           │   │       • Últimos 20 tracking events
           │   │
           │   └─► Retorna métricas
           │       {
           │         totalQuotes: number
           │         quotesByStatus: { [status]: count }
           │         conversionRate: number (0-100)
           │         totalValue: Decimal
           │         acceptedValue: Decimal
           │         recentQuotes: Quote[]
           │         recentActivity: TrackingEvent[]
           │       }
           │
           └─► Usuario visualiza dashboard
               • KPIs principales
               • Gráficos de conversión
               • Timeline de actividad
               • Cotizaciones pendientes
```

**Métricas Clave:**
- Tasa de conversión: % de cotizaciones aceptadas/firmadas
- Valor total: suma de todas las cotizaciones
- Valor aceptado: suma de cotizaciones cerradas exitosamente
- Distribución por estado
- Actividad reciente (tracking events)


---

## 🚀 FUNCIONALIDADES PLANIFICADAS (EXPANSIÓN MVP)

### Etapa 2: Calculadora Avanzada (PRÓXIMA)

**Objetivo:** Mejorar el sistema de cálculo con descuentos por item, impuestos variables y márgenes internos.

**Nuevos Campos en QuoteItem:**
```prisma
model QuoteItem {
  // ... campos existentes ...
  discount       Decimal  @default(0)  // Descuento por item
  taxRate        Decimal  @default(0)  // Tax rate específico del item
  internalCost   Decimal? // Costo interno (no visible al cliente)
}
```

**Cálculo Mejorado:**
```typescript
// Por item
item.subtotal = item.quantity * item.unitPrice
item.discountAmount = item.subtotal * (item.discount / 100)
item.subtotalAfterDiscount = item.subtotal - item.discountAmount
item.taxAmount = item.subtotalAfterDiscount * (item.taxRate / 100)
item.total = item.subtotalAfterDiscount + item.taxAmount

// Margen interno (no visible en vista pública)
item.margin = item.total - (item.internalCost * item.quantity)
item.marginPercentage = (item.margin / item.total) * 100

// Para la quote
quote.subtotal = sum(items.subtotalAfterDiscount)
quote.taxAmount = sum(items.taxAmount)
quote.total = quote.subtotal + quote.taxAmount - quote.discount
```

**Endpoints Nuevos:**
- POST /quotes/:id/recalculate - Recalcula totales
- GET /quotes/:id/margins - Obtiene márgenes internos (privado)


### Etapa 3: Customización y Branding

**Objetivo:** Permitir branding personalizado en vista pública y PDFs.

**Nuevo Modelo:**
```prisma
model BrandingSettings {
  id              String   @id @default(uuid())
  userId          String   @unique
  logoUrl         String?
  primaryColor    String   @default("#3B82F6")
  secondaryColor  String   @default("#1E40AF")
  footerText      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
}
```

**Flujo:**
```
Usuario → PUT /users/branding
  Body: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    footerText?: string
  }
  ↓
BrandingService.update
  • Valida colores (formato hex)
  • Valida URL de logo
  • Almacena configuración
  ↓
Vista pública aplica branding
  • Logo en header
  • Colores personalizados
  • Footer personalizado
  ↓
PDF generado con branding
  • Incluye logo
  • Aplica colores
  • Incluye footer
```

**Endpoints:**
- GET /users/branding - Obtiene configuración actual
- PUT /users/branding - Actualiza branding
- POST /users/branding/logo - Sube logo (S3)
- GET /users/branding/preview - Preview de branding


### Etapa 4: Tracking y Notificaciones en Tiempo Real

**Objetivo:** Notificaciones instantáneas mediante WebSockets cuando ocurren eventos.

**Arquitectura:**
```
Cliente (Frontend) ←─── WebSocket ───→ WebSocket Gateway
                                            │
                                            ├─► Autenticación JWT
                                            │
                                            ├─► Suscripción a quotes del usuario
                                            │
                                            └─► Emisión de eventos en tiempo real
```

**Flujo:**
```
Usuario → Conecta WebSocket
  ws://api.quotefast.com/ws?token={accessToken}
  ↓
WebSocketGateway.handleConnection
  • Valida JWT token
  • Registra conexión del usuario
  • Suscribe a room: user:{userId}
  ↓
Cuando ocurre evento (QUOTE_OPENED, QUOTE_SIGNED, etc.):
  ↓
TrackingService.registerEvent
  • Crea TrackingEvent en BD
  • Emite evento via WebSocket
  ↓
WebSocketGateway.emitToUser(userId, event)
  • Envía a room: user:{userId}
  • Payload: { type, quoteId, timestamp, metadata }
  ↓
Cliente recibe notificación
  • Actualiza UI en tiempo real
  • Muestra toast/notification
  • Actualiza lista de cotizaciones
```

**Eventos Emitidos:**
- quote:opened - Cliente abrió cotización
- quote:viewed - Cliente visualizó cotización
- quote:accepted - Cliente aceptó cotización
- quote:rejected - Cliente rechazó cotización
- quote:signed - Cliente firmó cotización
- quote:pdf_downloaded - Cliente descargó PDF

**Endpoints Adicionales:**
- GET /quotes/:id/tracking - Timeline completo de eventos
- GET /quotes/:id/tracking/stats - Estadísticas de tracking


### Etapa 5: Secuencias Automáticas (Follow-ups)

**Objetivo:** Envío automático de recordatorios para cotizaciones no vistas o no aceptadas.

**Nuevos Modelos:**
```prisma
model FollowUpSequence {
  id          String          @id @default(uuid())
  userId      String
  name        String
  isActive    Boolean         @default(true)
  isDefault   Boolean         @default(false)
  steps       FollowUpStep[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model FollowUpStep {
  id          String            @id @default(uuid())
  sequenceId  String
  order       Int
  delayDays   Int               // Días después del envío
  condition   FollowUpCondition // NOT_VIEWED, NOT_ACCEPTED
  subject     String
  message     String
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

model FollowUpExecution {
  id          String   @id @default(uuid())
  quoteId     String
  stepId      String
  executedAt  DateTime @default(now())
  success     Boolean
  error       String?
}

enum FollowUpCondition {
  NOT_VIEWED
  NOT_ACCEPTED
  NOT_SIGNED
}
```

**Flujo:**
```
Cron Job Diario (00:00 UTC)
  ↓
FollowUpService.processFollowUps
  │
  ├─► Para cada usuario con secuencias activas:
  │   │
  │   ├─► Busca cotizaciones elegibles:
  │   │   • status = SENT, VIEWED, o ACCEPTED
  │   │   • sentAt + delayDays = hoy
  │   │   • No tiene ejecución previa para este step
  │   │
  │   ├─► Para cada cotización elegible:
  │   │   │
  │   │   ├─► Evalúa condición del step:
  │   │   │   • NOT_VIEWED: status = SENT
  │   │   │   • NOT_ACCEPTED: status != ACCEPTED && status != SIGNED
  │   │   │   • NOT_SIGNED: status != SIGNED
  │   │   │
  │   │   ├─► Si condición cumplida:
  │   │   │   │
  │   │   │   ├─► Encola email en SQS
  │   │   │   │   {
  │   │   │   │     quoteId, stepId
  │   │   │   │     type: 'SEND_FOLLOWUP'
  │   │   │   │     subject, message
  │   │   │   │     retryCount: 0
  │   │   │   │   }
  │   │   │   │
  │   │   │   └─► Registra FollowUpExecution
  │   │   │       • Marca como enviado
  │   │   │       • Previene duplicados
  │   │   │
  │   │   └─► Si condición no cumplida:
  │   │       • Skip (cliente ya actuó)
  │   │
  │   └─► Worker procesa cola
  │       • Envía email de recordatorio
  │       • Incluye enlace público
  │       • Retry automático si falla
  │
  └─► Logs de ejecución
      • Cotizaciones procesadas
      • Emails enviados
      • Errores encontrados
```

**Secuencia por Defecto:**
```json
{
  "name": "Secuencia Estándar",
  "isDefault": true,
  "steps": [
    {
      "order": 1,
      "delayDays": 3,
      "condition": "NOT_VIEWED",
      "subject": "Recordatorio: Cotización pendiente",
      "message": "Hola, te enviamos una cotización hace 3 días..."
    },
    {
      "order": 2,
      "delayDays": 7,
      "condition": "NOT_ACCEPTED",
      "subject": "Última oportunidad: Cotización expira pronto",
      "message": "Esta cotización expira pronto..."
    }
  ]
}
```

**Endpoints:**
- GET /follow-ups/sequences - Lista secuencias
- POST /follow-ups/sequences - Crea secuencia
- PUT /follow-ups/sequences/:id - Actualiza secuencia
- DELETE /follow-ups/sequences/:id - Elimina secuencia
- GET /quotes/:id/follow-ups - Historial de follow-ups


### Etapa 6: Versionado de Cotizaciones

**Objetivo:** Mantener historial completo de cambios mediante snapshots automáticos.

**Nuevo Modelo:**
```prisma
model QuoteVersion {
  id          String   @id @default(uuid())
  quoteId     String
  version     Int      // Auto-incrementado
  snapshot    Json     // Snapshot completo de Quote + Items
  changedBy   String   // userId
  changeType  String   // CREATE, UPDATE, STATUS_CHANGE
  createdAt   DateTime @default(now())
  
  @@unique([quoteId, version])
  @@index([quoteId])
}
```

**Flujo:**
```
Usuario actualiza Quote
  ↓
QuotesService.update (con middleware)
  │
  ├─► Antes de actualizar:
  │   │
  │   └─► VersioningService.createSnapshot
  │       • Captura estado actual completo
  │       • Incluye Quote + Items + Client
  │       • Calcula próximo número de versión
  │       • Almacena en QuoteVersion
  │
  ├─► Actualiza Quote
  │
  └─► Retorna Quote actualizada

Usuario consulta historial
  ↓
GET /quotes/:id/versions
  ↓
VersioningService.getVersions
  • Lista todas las versiones
  • Incluye metadata de cambios
  • Ordenadas por version DESC
  ↓
Retorna:
  [
    {
      version: 3,
      changedBy: "user-id",
      changeType: "UPDATE",
      createdAt: "2026-03-25T10:00:00Z",
      changes: ["title", "items[0].quantity"]
    },
    ...
  ]

Usuario restaura versión anterior
  ↓
POST /quotes/:id/restore/:version
  ↓
VersioningService.restore
  │
  ├─► Crea snapshot de versión actual (backup)
  │
  ├─► Carga snapshot de versión solicitada
  │
  ├─► Restaura Quote + Items
  │   • Elimina items actuales
  │   • Recrea items de la versión
  │   • Actualiza campos de Quote
  │
  └─► Crea nueva versión (tipo: RESTORE)

Usuario compara versiones
  ↓
GET /quotes/:id/versions/:v1/compare/:v2
  ↓
VersioningService.compare
  • Carga ambos snapshots
  • Calcula diferencias (diff)
  • Retorna cambios estructurados
  ↓
Retorna:
  {
    added: { items: [...] },
    removed: { items: [...] },
    modified: {
      title: { old: "...", new: "..." },
      items: [
        { id: "...", field: "quantity", old: 5, new: 10 }
      ]
    }
  }
```

**Triggers de Snapshot:**
- Creación de cotización (version 1)
- Actualización de campos de Quote
- Adición/eliminación/modificación de Items
- Cambio de estado (DRAFT → SENT, etc.)
- Restauración de versión anterior

**Endpoints:**
- GET /quotes/:id/versions - Lista versiones
- GET /quotes/:id/versions/:version - Obtiene snapshot específico
- POST /quotes/:id/restore/:version - Restaura versión
- GET /quotes/:id/versions/:v1/compare/:v2 - Compara versiones


### Etapa 7: Exportación y Documentos

**Objetivo:** Generar PDFs profesionales y exportaciones CSV.

**Flujo de Generación de PDF:**
```
Usuario → GET /quotes/:id/pdf
  ↓
PdfService.generatePdf
  │
  ├─► Valida ownership de la quote
  │
  ├─► Carga datos completos:
  │   • Quote + Items + Client + User
  │   • BrandingSettings del usuario
  │   • Signature si existe
  │
  ├─► Si PDF ya existe y no hay cambios:
  │   • Retorna URL del PDF cacheado
  │
  ├─► Si necesita regenerar:
  │   │
  │   ├─► Encola job en Bull/SQS
  │   │   {
  │   │     quoteId: string
  │   │     type: 'GENERATE_PDF'
  │   │     priority: 'high'
  │   │   }
  │   │
  │   └─► Worker procesa (asíncrono):
  │       │
  │       ├─► Genera HTML con template
  │       │   • Aplica branding personalizado
  │       │   • Incluye logo, colores, footer
  │       │   • Tabla de items
  │       │   • Totales calculados
  │       │   • Términos y condiciones
  │       │   • Firma si existe
  │       │
  │       ├─► Convierte HTML a PDF (Puppeteer)
  │       │   • Formato A4
  │       │   • Márgenes profesionales
  │       │   • Header y footer
  │       │
  │       ├─► Sube PDF a S3
  │       │   • Bucket: quotefast-pdfs
  │       │   • Key: {userId}/{quoteId}.pdf
  │       │   • ACL: private
  │       │
  │       ├─► Actualiza Quote.pdfUrl
  │       │   • URL firmada de S3 (expira en 7 días)
  │       │
  │       └─► Notifica usuario (WebSocket)
  │           • Evento: pdf:ready
  │           • Payload: { quoteId, pdfUrl }
  │
  └─► Retorna:
      • Si síncrono: PDF stream
      • Si asíncrono: { status: 'processing', jobId }
```

**Flujo de Exportación CSV:**
```
Usuario → GET /quotes/export/csv?status=ACCEPTED&from=2026-01-01&to=2026-03-31
  ↓
ExportService.exportToCsv
  │
  ├─► Filtra quotes según parámetros
  │   • userId del usuario autenticado
  │   • status (opcional)
  │   • Rango de fechas (opcional)
  │
  ├─► Carga quotes con items
  │
  ├─► Genera CSV
  │   Columnas:
  │   • Quote ID, Title, Status, Client Name
  │   • Subtotal, Tax, Discount, Total
  │   • Created At, Sent At, Accepted At, Signed At
  │   • Item Count
  │
  └─► Retorna CSV file
      • Content-Type: text/csv
      • Content-Disposition: attachment; filename="quotes-export.csv"
```

**Endpoints:**
- GET /quotes/:id/pdf - Genera/obtiene PDF
- GET /quotes/:id/pdf/download - Descarga PDF
- GET /quotes/export/csv - Exporta a CSV
- POST /quotes/:id/pdf/regenerate - Fuerza regeneración


### Etapa 8: Colaboración en Equipos

**Objetivo:** Permitir trabajo colaborativo con roles y permisos.

**Nuevos Modelos:**
```prisma
model Team {
  id        String       @id @default(uuid())
  name      String
  ownerId   String
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  members   TeamMember[]
  quotes    Quote[]
  clients   Client[]
}

model TeamMember {
  id        String     @id @default(uuid())
  teamId    String
  userId    String
  role      TeamRole   @default(MEMBER)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  
  @@unique([teamId, userId])
}

model Comment {
  id        String   @id @default(uuid())
  quoteId   String
  userId    String
  content   String
  isInternal Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum TeamRole {
  OWNER   // Todos los permisos
  ADMIN   // Gestión de equipo + cotizaciones
  SALES   // Crear y editar cotizaciones
  VIEWER  // Solo lectura
}
```

**Flujo de Creación de Team:**
```
Usuario → POST /teams
  Body: { name: string }
  ↓
TeamsService.create
  • Crea Team
  • Asigna usuario como OWNER
  • Crea TeamMember automático
  ↓
Retorna Team creado

Usuario → POST /teams/:id/members
  Body: { email: string, role: TeamRole }
  ↓
TeamsService.addMember
  • Valida permisos (solo OWNER/ADMIN)
  • Busca usuario por email
  • Crea TeamMember
  • Envía invitación por email
  ↓
Retorna TeamMember creado
```

**Flujo de Autorización:**
```
Request → Endpoint protegido
  ↓
JwtAuthGuard
  • Valida JWT token
  • Extrae userId
  ↓
TeamAuthGuard (nuevo)
  • Extrae quoteId/clientId del request
  • Busca Team asociado
  • Verifica que userId es miembro del Team
  • Verifica rol tiene permisos necesarios
  ↓
Si autorizado: continúa
Si no autorizado: 403 Forbidden
```

**Matriz de Permisos:**
| Acción | OWNER | ADMIN | SALES | VIEWER |
|--------|-------|-------|-------|--------|
| Ver cotizaciones | ✓ | ✓ | ✓ | ✓ |
| Crear cotizaciones | ✓ | ✓ | ✓ | ✗ |
| Editar cotizaciones | ✓ | ✓ | ✓ | ✗ |
| Eliminar cotizaciones | ✓ | ✓ | ✗ | ✗ |
| Gestionar equipo | ✓ | ✓ | ✗ | ✗ |
| Eliminar equipo | ✓ | ✗ | ✗ | ✗ |
| Ver comentarios internos | ✓ | ✓ | ✓ | ✓ |
| Crear comentarios | ✓ | ✓ | ✓ | ✗ |

**Endpoints:**
- GET /teams - Lista teams del usuario
- POST /teams - Crea team
- GET /teams/:id - Obtiene team
- PUT /teams/:id - Actualiza team
- DELETE /teams/:id - Elimina team
- GET /teams/:id/members - Lista miembros
- POST /teams/:id/members - Agrega miembro
- DELETE /teams/:id/members/:userId - Remueve miembro
- PUT /teams/:id/members/:userId/role - Cambia rol
- POST /quotes/:id/comments - Agrega comentario
- GET /quotes/:id/comments - Lista comentarios


### Etapa 9: Optimización UX

**Objetivo:** Mejorar velocidad y experiencia con Quick Quote y editor avanzado.

**Quick Quote (Creación Rápida):**
```
Usuario → POST /quotes/quick
  Body: {
    clientEmail: string
    items: [
      { name: string, quantity: number, unitPrice: number }
    ]
    sendImmediately?: boolean
  }
  ↓
QuotesService.createQuick
  │
  ├─► Busca o crea Client por email
  │   • Si existe: usa existente
  │   • Si no existe: crea nuevo con email
  │
  ├─► Crea Quote
  │   • title = "Cotización para {clientName}"
  │   • status = DRAFT
  │   • Aplica template default si existe
  │
  ├─► Crea QuoteItems en batch
  │   • Calcula totales automáticamente
  │
  ├─► Si sendImmediately = true:
  │   • Cambia status a SENT
  │   • Encola email
  │
  └─► Retorna Quote completa
      • Tiempo total: < 30 segundos
```

**Editor Avanzado (Frontend):**
- Drag & drop para reordenar items
- Inline editing (doble click para editar)
- Cálculo en tiempo real de totales
- Autoguardado cada 3 segundos
- Undo/redo de cambios

**Optimización Mobile:**
- Vista pública responsive
- Canvas de firma táctil optimizado
- Botones grandes para touch
- Scroll suave en tabla de items
- Performance score > 90 (Lighthouse)

**Endpoints:**
- POST /quotes/quick - Creación rápida
- PATCH /quotes/:id/autosave - Autoguardado
- POST /quotes/:id/undo - Deshacer cambio
- POST /quotes/:id/redo - Rehacer cambio


---

## 🔐 SEGURIDAD

### Autenticación y Autorización

**JWT Tokens:**
- Access token: 15 minutos de duración
- Refresh token: 7 días de duración
- Secrets separados para cada tipo
- Refresh tokens almacenados hasheados (bcrypt)

**Protección de Endpoints:**
```typescript
// Endpoints privados (requieren autenticación)
@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  // Solo usuarios autenticados
}

// Endpoints públicos (sin autenticación)
@Controller('public/quotes')
export class PublicController {
  // Acceso mediante publicId
  // Rate limiting aplicado
}
```

**Validación de Ownership:**
- Todos los endpoints privados validan que el recurso pertenece al usuario
- Queries incluyen `userId` en WHERE clause
- Previene acceso a recursos de otros usuarios

### Rate Limiting

**Configuración Global:**
```typescript
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 20 },   // 20 req/sec
  { name: 'long',  ttl: 60000, limit: 300 }, // 300 req/min
])
```

**Endpoints Públicos (más restrictivo):**
```typescript
@Throttle({ short: { limit: 5, ttl: 1000 } })  // 5 req/sec
@Post('public/quotes/:publicId/sign')
```

### Validación de Inputs

**DTO Validation (class-validator):**
```typescript
export class SignQuoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  signerName: string;
  
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  signatureImage: string;
}
```

**Sanitización:**
- Prisma previene SQL injection (parameterized queries)
- Inputs trimmed y validados
- Tamaños máximos enforced
- Formatos validados (emails, URLs, base64)

### Headers de Seguridad

```typescript
// Helmet middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

### Auditoría

**Tracking de Eventos:**
- Todos los eventos incluyen IP y user-agent
- Timestamps precisos de todas las acciones
- Metadata adicional en JSON
- Inmutable (no se pueden editar/eliminar)

**Soft Delete:**
- Quotes eliminadas no se borran físicamente
- Campo `deletedAt` marca eliminación
- Preserva historial para auditoría
- Queries excluyen registros eliminados


---

## ⚡ PERFORMANCE

### Optimizaciones de Base de Datos

**Índices Estratégicos:**
```prisma
model Quote {
  @@index([userId])        // Queries por usuario
  @@index([status])        // Filtros por estado
  @@index([deletedAt])     // Soft delete queries
  @@index([publicId])      // Acceso público (unique)
}

model TrackingEvent {
  @@index([quoteId])       // Timeline de eventos
  @@index([createdAt])     // Ordenamiento temporal
}

model Signature {
  @@index([quoteId])       // Lookup de firma
}
```

**Prevención de N+1:**
```typescript
// Incluye relaciones en query inicial
const quote = await prisma.quote.findUnique({
  where: { id },
  include: {
    items: { orderBy: { order: 'asc' } },
    client: true,
    signature: true,
  },
});
```

### Caching

**Redis para Datos Frecuentes:**
```typescript
// Cache de branding settings (raramente cambian)
const branding = await redis.get(`branding:${userId}`);
if (!branding) {
  const settings = await prisma.brandingSettings.findUnique(...);
  await redis.set(`branding:${userId}`, JSON.stringify(settings), 'EX', 3600);
}

// Cache de templates default
const templates = await redis.get('templates:default');
```

**Cache de PDFs:**
- PDFs generados almacenados en S3
- URL firmada cacheada en Quote.pdfUrl
- Regeneración solo si hay cambios
- CloudFront CDN para distribución

### Procesamiento Asíncrono

**Cola SQS/Bull para Tareas Pesadas:**
```typescript
// Envío de emails
await sqsService.enqueue({
  type: 'SEND_EMAIL',
  quoteId,
  retryCount: 0,
});

// Generación de PDFs
await bullQueue.add('generate-pdf', {
  quoteId,
  priority: 'high',
});

// Follow-ups automáticos
await bullQueue.add('process-followups', {}, {
  repeat: { cron: '0 0 * * *' }, // Diario a medianoche
});
```

**Workers Separados:**
- Email worker: procesa envíos de email
- PDF worker: genera PDFs
- Cron worker: follow-ups y expiración

### Paginación

**Listados Paginados:**
```typescript
GET /quotes?page=1&limit=20

const skip = (page - 1) * limit;
const [data, total] = await Promise.all([
  prisma.quote.findMany({ skip, take: limit }),
  prisma.quote.count(),
]);

return { data, total, page, limit };
```

### Métricas de Performance

**SLA Targets:**
- Endpoints de lectura: < 200ms (p95)
- Endpoints de escritura: < 500ms (p95)
- Vista pública: < 300ms (p95)
- Firma electrónica: < 500ms (p95)
- Generación PDF: < 3 segundos

**Monitoreo:**
- CloudWatch metrics
- Application Performance Monitoring (APM)
- Logs estructurados (JSON)
- Alertas automáticas en degradación


---

## 🔄 DIAGRAMA DE ESTADOS COMPLETO

### Transiciones de Estado de Quote

```
                    ┌──────────┐
                    │  DRAFT   │ (Estado inicial)
                    └────┬─────┘
                         │
                         │ send()
                         ↓
                    ┌──────────┐
              ┌────→│   SENT   │←────┐
              │     └────┬─────┘     │
              │          │            │
              │          │ open()     │ send() (reenvío)
              │          ↓            │
              │     ┌──────────┐     │
              │     │  VIEWED  │─────┘
              │     └────┬─────┘
              │          │
              │          ├─────────────┐
              │          │             │
              │          │ accept()    │ reject()
              │          ↓             ↓
              │     ┌──────────┐ ┌──────────┐
              │     │ ACCEPTED │ │ REJECTED │ (Estados terminales)
              │     └──────────┘ └──────────┘
              │
              │ sign()
              ↓
         ┌──────────┐
         │  SIGNED  │ (Estado terminal)
         └──────────┘

         ┌──────────┐
         │ EXPIRED  │ (Estado terminal, por cron)
         └──────────┘
```

**Reglas de Transición:**

| Desde | A | Acción | Validación |
|-------|---|--------|------------|
| DRAFT | SENT | send() | Debe tener items |
| SENT | VIEWED | open() | Automático en primera vista |
| SENT | SIGNED | sign() | Firma válida |
| VIEWED | SIGNED | sign() | Firma válida |
| VIEWED | ACCEPTED | accept() | No expirada |
| VIEWED | REJECTED | reject() | No expirada |
| SENT | SENT | send() | Reenvío permitido |
| VIEWED | SENT | send() | Reenvío permitido |
| * | EXPIRED | cron | validUntil < now |

**Estados Terminales (no permiten cambios):**
- ACCEPTED
- REJECTED
- EXPIRED
- SIGNED (puede refirmarse, pero mantiene estado)


---

## 📡 API ENDPOINTS COMPLETOS

### Autenticación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /auth/register | Registro de usuario | No |
| POST | /auth/login | Login | No |
| POST | /auth/refresh | Renovar tokens | No |
| POST | /auth/logout | Cerrar sesión | Sí |

### Usuarios

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /users/me | Perfil del usuario | Sí |
| PUT | /users/me | Actualizar perfil | Sí |
| GET | /users/branding | Obtener branding | Sí |
| PUT | /users/branding | Actualizar branding | Sí |

### Clientes

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /clients | Listar clientes | Sí |
| POST | /clients | Crear cliente | Sí |
| GET | /clients/:id | Obtener cliente | Sí |
| PUT | /clients/:id | Actualizar cliente | Sí |
| DELETE | /clients/:id | Eliminar cliente | Sí |

### Cotizaciones

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /quotes | Listar cotizaciones | Sí |
| POST | /quotes | Crear cotización | Sí |
| POST | /quotes/quick | Creación rápida | Sí |
| GET | /quotes/:id | Obtener cotización | Sí |
| PUT | /quotes/:id | Actualizar cotización | Sí |
| DELETE | /quotes/:id | Eliminar cotización | Sí |
| POST | /quotes/:id/duplicate | Duplicar cotización | Sí |
| POST | /quotes/:id/send | Enviar cotización | Sí |
| GET | /quotes/:id/pdf | Generar/obtener PDF | Sí |
| GET | /quotes/:id/tracking | Timeline de eventos | Sí |
| GET | /quotes/:id/versions | Historial de versiones | Sí |
| POST | /quotes/:id/restore/:version | Restaurar versión | Sí |

### Items de Cotización

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /quotes/:quoteId/items | Crear item | Sí |
| PUT | /quotes/:quoteId/items/:id | Actualizar item | Sí |
| DELETE | /quotes/:quoteId/items/:id | Eliminar item | Sí |
| PATCH | /quotes/:quoteId/items/reorder | Reordenar items | Sí |

### Vista Pública (Sin Auth)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /public/quotes/:publicId | Ver cotización | No |
| POST | /public/quotes/:publicId/accept | Aceptar cotización | No |
| POST | /public/quotes/:publicId/reject | Rechazar cotización | No |
| POST | /public/quotes/:publicId/sign | Firmar cotización ✨ | No |
| GET | /public/quotes/:publicId/pdf | Descargar PDF | No |

### Templates

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /templates | Listar templates | Sí |
| POST | /templates | Crear template | Sí |
| GET | /templates/:id | Obtener template | Sí |
| PUT | /templates/:id | Actualizar template | Sí |
| DELETE | /templates/:id | Eliminar template | Sí |

### Dashboard

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /dashboard/metrics | Métricas del usuario | Sí |
| GET | /dashboard/activity | Actividad reciente | Sí |

### Follow-ups (Futuro)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /follow-ups/sequences | Listar secuencias | Sí |
| POST | /follow-ups/sequences | Crear secuencia | Sí |
| PUT | /follow-ups/sequences/:id | Actualizar secuencia | Sí |
| DELETE | /follow-ups/sequences/:id | Eliminar secuencia | Sí |

### Teams (Futuro)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /teams | Listar teams | Sí |
| POST | /teams | Crear team | Sí |
| GET | /teams/:id | Obtener team | Sí |
| PUT | /teams/:id | Actualizar team | Sí |
| DELETE | /teams/:id | Eliminar team | Sí |
| GET | /teams/:id/members | Listar miembros | Sí |
| POST | /teams/:id/members | Agregar miembro | Sí |
| DELETE | /teams/:id/members/:userId | Remover miembro | Sí |


---

## 🧪 TESTING

### Estrategia de Testing

**Niveles de Testing:**
1. Unit Tests: Lógica de negocio aislada
2. Integration Tests: Servicios + BD
3. Property-Based Tests: Validación universal
4. E2E Tests: Flujos completos

### Property-Based Testing (PBT)

**Implementado en Firma Electrónica:**

```typescript
// signature.validation.pbt.spec.ts
describe('Signature Validation Properties', () => {
  it('P2: accepts all valid signer names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 255 })
          .filter(s => s.trim().length > 0),
        async (name) => {
          service.validateSignerName(name);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// signature.state-transitions.pbt.spec.ts
describe('Signature State Transition Properties', () => {
  it('P1: only signable states accept signatures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NON_SIGNABLE_STATUSES),
        async (status) => {
          const quote = await createTestQuote({ status });
          await expect(
            service.signQuote({ publicId: quote.publicId, ... })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// signature.idempotence.pbt.spec.ts
describe('Signature Idempotence Properties', () => {
  it('P10: multiple signatures maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validSignatureData, { minLength: 2, maxLength: 5 }),
        async (signatures) => {
          const quote = await createTestQuote({ status: 'SENT' });
          
          for (const sig of signatures) {
            await service.signQuote({ publicId: quote.publicId, ...sig });
          }
          
          const finalSignature = await prisma.signature.findUnique({
            where: { quoteId: quote.id }
          });
          
          const lastSig = signatures[signatures.length - 1];
          return finalSignature.signerName === lastSig.signerName;
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

**Archivos de PBT:**
- signature.validation.pbt.spec.ts (Propiedades 2, 3, 4, 5)
- signature.persistence.pbt.spec.ts (Propiedad 6)
- signature.state-transitions.pbt.spec.ts (Propiedades 1, 7)
- signature.tracking.pbt.spec.ts (Propiedad 8)
- signature.response.pbt.spec.ts (Propiedad 9)
- signature.idempotence.pbt.spec.ts (Propiedad 10)
- signature.concurrency.pbt.spec.ts (Concurrencia)

### Coverage Targets

**Mínimos Requeridos:**
- Unit tests: > 80% coverage
- Integration tests: flujos críticos
- PBT: 100 iteraciones mínimo por propiedad
- E2E: happy paths + error scenarios

**Comandos:**
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov

# PBT específicos
npm run test signature.*.pbt.spec.ts
```


---

## 🚀 DEPLOYMENT

### Arquitectura de Infraestructura

```
┌─────────────────────────────────────────────────────────┐
│                      CloudFront CDN                      │
│                    (Static Assets)                       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                   Application Load Balancer              │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
│   ECS Task   │  │  ECS Task   │  │  ECS Task  │
│  (Backend)   │  │  (Backend)  │  │  (Backend) │
└───────┬──────┘  └──────┬──────┘  └─────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
│   RDS        │  │   Redis     │  │    SQS     │
│ PostgreSQL   │  │   Cache     │  │   Queue    │
└──────────────┘  └─────────────┘  └────────────┘
```

### Variables de Entorno

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/quotefast

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=quotefast-pdfs
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key

# Frontend
FRONTEND_URL=https://app.quotefast.com

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

### Proceso de Deploy

```bash
# 1. Build Docker image
docker build -t quotefast-backend:latest .

# 2. Tag image
docker tag quotefast-backend:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/quotefast:latest

# 3. Push to ECR
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/quotefast:latest

# 4. Update ECS service
aws ecs update-service \
  --cluster quotefast-cluster \
  --service quotefast-backend \
  --force-new-deployment

# 5. Run migrations
npm run prisma:migrate:deploy
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run test:integration
      
  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
      - name: Build and push Docker image
        run: |
          docker build -t quotefast .
          docker push $ECR_REGISTRY/quotefast:latest
      - name: Deploy to ECS
        run: |
          aws ecs update-service --force-new-deployment
```

### Monitoreo

**CloudWatch Metrics:**
- Request count
- Response time (p50, p95, p99)
- Error rate
- Database connections
- Queue depth

**Logs:**
- Structured JSON logs
- Centralized en CloudWatch Logs
- Retention: 30 días

**Alertas:**
- Error rate > 1%
- Response time p95 > 1s
- Database connections > 80%
- Queue depth > 1000


---

## 📈 ROADMAP Y PRIORIDADES

### Estado Actual (MVP + Firma Electrónica)

✅ **Completado:**
- Autenticación y autorización (JWT)
- Gestión de usuarios y clientes
- CRUD completo de cotizaciones
- Sistema de items con cálculo de totales
- Vista pública para clientes
- Aceptación/rechazo de cotizaciones
- Sistema de tracking de eventos
- Dashboard con métricas básicas
- Templates de cotizaciones
- Firma electrónica digital ✨

### Próximas Etapas (Orden Recomendado)

**Q2 2026:**
1. ✅ Etapa 1: Firma Electrónica (COMPLETADA)
2. 🔜 Etapa 2: Calculadora Avanzada (2 semanas)
3. 🔜 Etapa 3: Customización y Branding (1 semana)

**Q3 2026:**
4. 📅 Etapa 4: Tracking en Tiempo Real (3 semanas)
5. 📅 Etapa 5: Secuencias Automáticas (3 semanas)
6. 📅 Etapa 6: Versionado de Cotizaciones (2 semanas)

**Q4 2026:**
7. 📅 Etapa 7: Exportación y Documentos (2 semanas)
8. 📅 Etapa 8: Colaboración en Equipos (3 semanas)
9. 📅 Etapa 9: Optimización UX (2 semanas)

### Métricas de Éxito

**KPIs Actuales:**
- Usuarios registrados: tracking
- Cotizaciones creadas: tracking
- Tasa de conversión: (ACCEPTED + SIGNED) / SENT
- Tiempo promedio de respuesta: tracking events

**KPIs Futuros:**
- Tasa de apertura de cotizaciones
- Tiempo promedio hasta firma
- Tasa de conversión por follow-up
- Engagement con notificaciones en tiempo real
- Adopción de features de equipo

### Mejoras Continuas

**Performance:**
- Optimización de queries lentas
- Implementación de caching estratégico
- CDN para assets estáticos
- Compresión de respuestas

**Seguridad:**
- Auditorías de seguridad regulares
- Penetration testing
- Actualización de dependencias
- Implementación de 2FA

**UX:**
- A/B testing de flujos
- Feedback de usuarios
- Analytics de uso
- Mejoras iterativas


---

## 🎓 GLOSARIO DE TÉRMINOS

**Quote (Cotización):** Documento comercial que detalla productos/servicios ofrecidos con precios.

**QuoteItem (Item de Cotización):** Línea individual dentro de una cotización (producto/servicio).

**Public ID:** Identificador único público (UUID) usado en URLs públicas, diferente del ID interno.

**Signature (Firma Electrónica):** Captura digital de firma manuscrita con metadata de auditoría.

**Tracking Event:** Registro de evento en el ciclo de vida de una cotización (apertura, firma, etc.).

**Template:** Plantilla predefinida para crear cotizaciones rápidamente con valores por defecto.

**Follow-up:** Recordatorio automático enviado cuando una cotización no ha sido vista/aceptada.

**Branding:** Personalización visual (logo, colores, footer) aplicada a cotizaciones.

**Soft Delete:** Eliminación lógica (marca deletedAt) sin borrar físicamente el registro.

**Property-Based Testing (PBT):** Testing que verifica propiedades universales con inputs generados aleatoriamente.

**Idempotencia:** Propiedad donde ejecutar la misma operación múltiples veces produce el mismo resultado.

**Rate Limiting:** Limitación de número de requests por unidad de tiempo para prevenir abuso.

**JWT (JSON Web Token):** Token de autenticación firmado digitalmente con claims del usuario.

**Snapshot:** Copia completa del estado de una cotización en un momento específico.

**Terminal State:** Estado final de una cotización que no permite más transiciones.

**Signable State:** Estado que permite firmar la cotización (SENT o VIEWED).

**Ownership Validation:** Verificación de que un recurso pertenece al usuario autenticado.

**Audit Trail:** Registro completo e inmutable de todas las acciones sobre un recurso.

**Conversion Rate:** Porcentaje de cotizaciones enviadas que resultan en aceptación/firma.

---

## 📚 REFERENCIAS

### Documentación Técnica
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [fast-check Documentation](https://fast-check.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Especificaciones del Proyecto
- `test/docs/PLAN-DE-TRABAJO-EXPANSION-MVP.md` - Plan de expansión completo
- `.kiro/specs/electronic-signature/requirements.md` - Requisitos de firma electrónica
- `.kiro/specs/electronic-signature/design.md` - Diseño técnico de firma electrónica
- `.kiro/specs/electronic-signature/tasks.md` - Tareas de implementación

### Código Fuente Principal
- `test/backend/src/app.module.ts` - Módulo principal
- `test/backend/src/quotes/quotes.service.ts` - Servicio de cotizaciones
- `test/backend/src/public/signature.service.ts` - Servicio de firma electrónica
- `test/backend/src/tracking/tracking.service.ts` - Servicio de tracking
- `test/backend/prisma/schema.prisma` - Esquema de base de datos

---

**Última actualización:** 2026-03-25  
**Versión del documento:** 1.0  
**Autor:** Sistema QuoteFast  
**Estado:** Documentación completa del sistema actual y planificado

