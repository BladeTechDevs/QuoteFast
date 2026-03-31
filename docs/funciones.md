# Funciones del Proyecto

Documentación de cada función existente en el backend, organizada por módulo/servicio.

---

## AuthService (`src/auth/auth.service.ts`)

### `register(dto)`
Registra un nuevo usuario. Verifica que el email no esté en uso, hashea la contraseña con bcrypt (12 rondas), crea el usuario en la base de datos, genera un par de tokens JWT y almacena el hash del refresh token. Retorna los tokens y los datos básicos del usuario.

### `login(dto)`
Autentica un usuario existente. Busca el usuario por email y compara la contraseña con bcrypt. Si las credenciales son inválidas, lanza `UnauthorizedException` sin revelar si el email existe o no. Genera nuevos tokens y actualiza el hash del refresh token almacenado.

### `refresh(refreshToken)`
Renueva el access token usando un refresh token válido. Verifica la firma del token con `JWT_REFRESH_SECRET`, busca el usuario, compara el token recibido con el hash almacenado en la base de datos. Si todo es válido, genera un nuevo par de tokens.

### `logout(userId)`
Invalida la sesión del usuario poniendo `refreshToken = null` en la base de datos. Cualquier intento de refresh posterior fallará.

### `generateTokens(userId, email)` _(privada)_
Genera en paralelo un access token (expira en 15 min) y un refresh token (expira en 7 días) usando `JWT_SECRET` y `JWT_REFRESH_SECRET` respectivamente.

### `storeRefreshTokenHash(userId, refreshToken)` _(privada)_
Hashea el refresh token con bcrypt y lo persiste en el campo `refreshToken` del usuario. Esto permite invalidar tokens sin almacenarlos en texto plano.

---

## AuthController (`src/auth/auth.controller.ts`)

### `register(dto)` → `POST /api/auth/register`
Llama a `AuthService.register`. Sin autenticación requerida.

### `login(dto)` → `POST /api/auth/login`
Llama a `AuthService.login`. Throttle estricto: 5 intentos por minuto.

### `refresh(dto)` → `POST /api/auth/refresh`
Llama a `AuthService.refresh` con el `refreshToken` del body.

### `logout(user)` → `POST /api/auth/logout`
Requiere JWT. Llama a `AuthService.logout` con el ID del usuario autenticado.

### `me(user)` → `GET /api/auth/me`
Requiere JWT. Retorna el objeto del usuario actual inyectado por el guard.

### `usage(user)` → `GET /api/auth/usage`
Requiere JWT. Cuenta las cotizaciones creadas en el mes actual y retorna el uso del plan: `quotesThisMonth`, `quotesLimit`, `quotesRemaining`, `periodStart`, `periodEnd`. El límite es `null` para planes PRO, TEAM y BUSINESS (sin límite).

---

## ClientsService (`src/clients/clients.service.ts`)

### `create(userId, dto)`
Crea un nuevo cliente asociado al usuario. Persiste todos los campos opcionales (email, company, phone, address, notes).

### `findAll(userId, query)`
Lista los clientes del usuario con paginación. Acepta `page` y `limit` (default 20). Retorna `{ data, total, page, limit }`.

### `findOne(userId, id)`
Busca un cliente por ID verificando que pertenezca al usuario. Lanza `NotFoundException` si no existe.

### `update(userId, id, dto)`
Actualiza los campos de un cliente. Primero verifica que exista con `findOne`, luego aplica los cambios.

### `remove(userId, id)`
Elimina un cliente. Antes verifica que no tenga cotizaciones asociadas; si las tiene, lanza `ConflictException` para proteger la integridad referencial.

---

## QuotesService (`src/quotes/quotes.service.ts`)

### `create(userId, dto)`
Crea una cotización en estado `DRAFT`. Si el usuario está en plan FREE, llama a `enforceFreePlanLimit` antes de crear. Si se provee un `templateId`, primero busca una `QuoteTemplate` (nuevo modelo con ítems estructurados); si no existe como `QuoteTemplate`, hace fallback al modelo `Template` legado. Los valores del DTO tienen precedencia sobre los de la plantilla (nullish coalescing). Si la `QuoteTemplate` tiene `TemplateItem`, los copia como `QuoteItem` dentro de una transacción y recalcula los totales de la cotización (`subtotal`, `taxAmount`, `total`). Lanza `NotFoundException` si el `templateId` no corresponde a ninguna plantilla accesible.

### `findAll(userId, query)`
Lista cotizaciones del usuario con paginación, filtro por `status`, búsqueda por título (case-insensitive) y ordenamiento configurable. Excluye cotizaciones con soft delete. Retorna `{ data, total, page, limit }`.

### `findOne(userId, id)`
Busca una cotización por ID verificando que pertenezca al usuario y no esté eliminada. Incluye ítems ordenados y cliente. Lanza `NotFoundException` si no existe.

### `update(userId, id, dto)`
Actualiza los campos de una cotización. Solo actualiza los campos presentes en el DTO (patch parcial). Incluye ítems y cliente en la respuesta.

### `remove(userId, id)`
Soft delete: establece `deletedAt = now()` en lugar de eliminar el registro. Preserva el historial de auditoría.

### `duplicate(userId, id)`
Crea una copia de una cotización existente con el título `"... (copy)"` y estado `DRAFT`. Copia todos los ítems. Verifica el límite del plan FREE antes de crear.

### `recalculate(userId, quoteId)`
Recalcula el `total` de cada ítem y los totales de la cotización (subtotal, taxAmount, total) usando las fórmulas de `calculate-totals`. No aplica a cotizaciones en estados terminales (ACCEPTED, REJECTED, EXPIRED).

### `enforceFreePlanLimit(userId)` _(privada)_
Cuenta las cotizaciones creadas en el mes actual. Si llega a 5, lanza `ForbiddenException` con mensaje de upgrade.

---

## QuotesSendService (`src/quotes/quotes-send.service.ts`)

### `send(userId, quoteId)`
Envía una cotización. Verifica que exista y pertenezca al usuario, y que tenga al menos un ítem (si no, lanza `UnprocessableEntityException`). Actualiza el estado a `SENT` y registra `sentAt`. Si las credenciales AWS están configuradas, encola un job `SEND_QUOTE` en SQS; en desarrollo sin AWS, solo loguea.

---

## QuotesRemindersService (`src/quotes/quotes-reminders.service.ts`)

### `runDailyJobs()` _(cron: todos los días a las 9am UTC)_
Ejecuta en paralelo `sendFollowUpReminders`, `expireOverdueQuotes` y `purgeOldNotifications`.

### `sendFollowUpReminders()` _(privada)_
Busca cotizaciones en estado `SENT` que no han sido vistas (`viewedAt = null`) y fueron enviadas hace más de 3 días. Por cada una, encola un job `SEND_EMAIL` en SQS para enviar un recordatorio al cliente y crea una notificación `QUOTE_REMINDER_SENT` para el dueño.

### `expireOverdueQuotes()` _(privada)_
Busca cotizaciones en estado `SENT` o `VIEWED` cuya `validUntil` ya pasó. Las marca como `EXPIRED` y crea una notificación `QUOTE_EXPIRED` por cada una.

### `purgeOldNotifications()` _(privada)_
Llama a `NotificationsService.deleteOldAll()` para eliminar todas las notificaciones leídas con más de 3 días de antigüedad.

---

## QuoteItemsService (`src/quote-items/quote-items.service.ts`)

### `create(userId, quoteId, dto)`
Agrega un ítem a una cotización. Verifica que la cotización exista y no esté en estado terminal. Calcula el `total` del ítem con `calculateItemTotal`. Si no se especifica `order`, lo coloca al final. Después de crear, llama a `recalculateTotals` para actualizar los totales de la cotización.

### `update(userId, quoteId, itemId, dto)`
Actualiza un ítem existente. Recalcula el `total` del ítem con los nuevos valores. Llama a `recalculateTotals` al finalizar.

### `remove(userId, quoteId, itemId)`
Elimina un ítem de la cotización. Llama a `recalculateTotals` para actualizar los totales.

### `getQuoteForUser(userId, quoteId)` _(privada)_
Helper que busca una cotización verificando ownership. Lanza `NotFoundException` si no existe.

### `assertNotTerminal(status)` _(privada)_
Lanza `UnprocessableEntityException` si el estado de la cotización es ACCEPTED, REJECTED o EXPIRED. Impide modificar ítems de cotizaciones cerradas.

### `recalculateTotals(quoteId)` _(privada)_
Recalcula y persiste `subtotal`, `taxAmount` y `total` de la cotización sumando todos sus ítems actuales con `calculateQuoteTotals`.

---

## PublicQuotesService (`src/public/public-quotes.service.ts`)

### `findByPublicId(publicId)`
Busca una cotización por su `publicId` público. Incluye ítems, cliente, datos del emisor y configuración de branding. Retorna la forma pública (sin `internalCost` de los ítems).

### `getQuoteAndTrackOpen(publicId, ipAddress?, userAgent?)`
Igual que `findByPublicId` pero además registra un evento `QUOTE_OPENED` de forma asíncrona (fire-and-forget, no bloquea la respuesta). Si es la primera vez que se abre, el `TrackingService` actualiza `viewedAt` y cambia el estado a `VIEWED`.

### `accept(publicId, ipAddress?, userAgent?)`
Acepta una cotización pública. Verifica que no esté en estado terminal. Actualiza el estado a `ACCEPTED` y registra `acceptedAt`. Registra evento `QUOTE_ACCEPTED` en tracking. Si AWS está configurado, encola un email de notificación al dueño.

### `reject(publicId, ipAddress?, userAgent?)`
Rechaza una cotización pública. Igual que `accept` pero con estado `REJECTED` y evento `QUOTE_REJECTED`.

### `trackPdfDownload(publicId, ipAddress?, userAgent?)`
Registra un evento `QUOTE_PDF_DOWNLOADED` en tracking cuando el cliente descarga el PDF.

### `toPublicShape(quote)` _(privada)_
Transforma el objeto de cotización de la base de datos al formato público seguro. Omite deliberadamente `internalCost` de los ítems para no exponer costos internos al cliente. Incluye datos de branding con valores por defecto si no están configurados.

---

## SignatureService (`src/public/signature.service.ts`)

### `validateSignerName(name)`
Valida que el nombre del firmante no esté vacío y no supere 255 caracteres. Lanza `BadRequestException` si falla.

### `validateSignatureImage(image)`
Valida que la imagen de firma sea un data URI base64 válido con MIME type de imagen (png, jpeg, jpg, webp) y que no supere 5MB. Lanza `BadRequestException` si falla.

### `signQuote(params)`
Procesa la firma electrónica de una cotización. Valida nombre e imagen, verifica que la cotización exista y esté en estado `SENT` o `VIEWED`. Ejecuta una transacción Prisma que: (1) hace upsert de la firma, (2) actualiza el estado de la cotización a `ACCEPTED` con `signedAt` y `acceptedAt`. Registra evento `QUOTE_ACCEPTED` con metadata `{ via: 'signature' }`. Retorna `{ id, quoteStatus, signedAt }`.

---

## TrackingService (`src/tracking/tracking.service.ts`)

### `registerEvent(options)`
Registra un evento de tracking en la base de datos con `quoteId`, `eventType`, `ipAddress`, `userAgent` y `metadata` opcionales. Si el evento es `QUOTE_OPENED` y es la primera vez que se abre (`viewedAt === null`), actualiza `viewedAt` en la cotización y, si estaba en estado `SENT`, la cambia a `VIEWED`.

---

## DashboardService (`src/dashboard/dashboard.service.ts`)

### `getDashboard(userId)`
Ejecuta 4 queries en paralelo para construir el dashboard:
1. Conteo de cotizaciones agrupado por estado
2. Valor total y promedio del pipeline (cotizaciones en SENT + VIEWED)
3. Las últimas 10 cotizaciones con cliente
4. Tiempos de aceptación de las últimas 50 cotizaciones aceptadas

Con esos datos calcula:
- `conversionRate`: porcentaje de cotizaciones aceptadas sobre el total enviado
- `openRate`: porcentaje de cotizaciones vistas sobre el total enviado
- `avgDaysToAccept`: promedio de días entre `sentAt` y `acceptedAt`

Retorna todos estos valores junto con `recentQuotes` y `pipelineValue`.

---

## BrandingService (`src/branding/branding.service.ts`)

### `getBranding(userId)`
Obtiene la configuración de marca del usuario. Si no tiene configuración, retorna los valores por defecto (`primaryColor: '#2563eb'`, `accentColor: '#1d4ed8'`).

### `upsertBranding(userId, dto)`
Crea o actualiza la configuración de marca del usuario usando `upsert` de Prisma.

### `getBrandingByQuotePublicId(publicId)`
Obtiene el branding del dueño de una cotización a partir del `publicId` público. Usado en la vista pública para aplicar los colores y logo del emisor. Retorna defaults si no hay configuración.

### `defaultBranding()` _(privada)_
Retorna el objeto de branding por defecto con colores azul corporativo y campos nulos.

---

## TemplatesService (`src/templates/templates.service.ts`) — Legado

### `onModuleInit()`
Hook de NestJS que se ejecuta al iniciar el módulo. Llama a `seedDefaultTemplates` para asegurar que las plantillas del sistema existan.

### `seedDefaultTemplates()` _(privada)_
Crea las 2 plantillas del sistema si no existen: "Propuesta de Servicios Profesionales" y "Propuesta de Desarrollo de Software". Solo crea las que faltan, no duplica.

### `create(userId, dto)`
Crea una plantilla personalizada para el usuario con `isDefault = false`.

### `findAll(userId, userPlan)`
Lista las plantillas disponibles para el usuario: las propias más las del sistema (`isDefault = true, userId = null`).

### `findOne(userId, id)`
Busca una plantilla por ID. Permite acceder tanto a las propias como a las del sistema. Lanza `NotFoundException` si no existe.

### `update(userId, id, dto)`
Actualiza una plantilla. Solo permite modificar plantillas propias del usuario. Lanza `NotFoundException` si no existe o no pertenece al usuario.

### `remove(userId, id)`
Elimina una plantilla propia del usuario. No permite eliminar plantillas del sistema.

---

## CatalogService (`src/catalog/catalog.service.ts`)

### `create(userId, dto)`
Crea un nuevo `CatalogItem` asociado al usuario. Aplica defaults de 0 para `taxRate`, `discount` e `internalCost` si no se proporcionan.

### `findAll(userId, query)`
Lista los `CatalogItem` del usuario con paginación (`page`, `limit`, default 20) y búsqueda case-insensitive por `name` o `description`. Retorna `{ data, total, page, limit }`.

### `update(userId, id, dto)`
Aplica un patch parcial al `CatalogItem`. Verifica ownership con `findFirst({ where: { id, userId } })`. Lanza `NotFoundException` si no pertenece al usuario.

### `remove(userId, id)`
Elimina permanentemente el `CatalogItem`. Verifica ownership antes de eliminar. Lanza `NotFoundException` si no pertenece al usuario. La eliminación no afecta los `QuoteItem` que copiaron sus datos (no hay FK).

---

## QuoteTemplatesService (`src/templates/quote-templates.service.ts`)

### `create(userId, dto)`
Crea una `QuoteTemplate` con `isDefault = false`. Si el DTO incluye `items`, los crea como `TemplateItem` dentro de una transacción Prisma. Retorna la plantilla con sus ítems incluidos.

### `findAll(userId)`
Retorna las `QuoteTemplate` propias del usuario más las del sistema (`isDefault = true, userId = null`), incluyendo sus `TemplateItem` ordenados por `order` ascendente.

### `findOne(userId, id)`
Retorna una `QuoteTemplate` con sus `TemplateItem` ordenados. Permite acceder a plantillas propias y del sistema. Lanza `NotFoundException` si no existe o no es accesible.

### `update(userId, id, dto)`
Actualiza los metadatos de la plantilla. Si el DTO incluye `items`, reemplaza completamente la lista de `TemplateItem` (delete + createMany en transacción). Lanza `ForbiddenException` (403) si la plantilla es del sistema (`isDefault = true`). Lanza `NotFoundException` si no existe.

### `remove(userId, id)`
Elimina la `QuoteTemplate` y todos sus `TemplateItem` en cascada (manejado por Prisma `onDelete: Cascade`). Lanza `ForbiddenException` (403) si es del sistema. Lanza `NotFoundException` si no existe o no pertenece al usuario.

---

## QuotesService — método `saveAsTemplate` (`src/quotes/quotes.service.ts`)

### `saveAsTemplate(userId, quoteId, dto)`
Guarda una `Quote` existente como nueva `QuoteTemplate`. Copia los metadatos de la cotización (`currency`, `taxRate`, `discount`, `notes`, `terms`) y todos sus `QuoteItem` como `TemplateItem` dentro de una transacción. Lanza `NotFoundException` si la cotización no pertenece al usuario. Retorna la `QuoteTemplate` creada con sus ítems.

---

## PrismaService (`src/prisma/prisma.service.ts`)

### `onModuleInit()`
Abre la conexión a la base de datos al iniciar el módulo NestJS.

### `onModuleDestroy()`
Cierra la conexión a la base de datos al destruir el módulo (shutdown graceful).

---

## Workers Lambda (`workers/src/`)

### `handler(event)` — email-worker
Punto de entrada Lambda. Itera sobre los registros SQS del evento y llama a `processRecord` por cada uno.

### `processRecord(record)` — email-worker
Parsea el body del mensaje SQS. Solo procesa mensajes de tipo `SEND_QUOTE` o `SEND_EMAIL`. Llama a `sendWithRetry`.

### `sendWithRetry(quoteId, attempt)` — email-worker
Implementa la lógica de reintentos con backoff (0s, 30s, 5min). Si supera 3 intentos, lanza error para que el mensaje vaya a la DLQ. Llama a `sendEmail`.

### `sendEmail(quoteId)` — email-worker
Consulta la cotización en la base de datos, genera el HTML y texto del email con el link público, y lo envía via AWS SES. Actualiza el estado de la cotización a `SENT`.

### `handler(event)` — pdf-worker
Punto de entrada Lambda. Itera sobre los registros SQS.

### `processRecord(record)` — pdf-worker
Parsea el mensaje. Solo procesa `SEND_QUOTE` o `GENERATE_PDF`. Consulta la cotización con ítems, cliente y usuario. Llama a `generatePdf` y sube el resultado a S3.

### `generatePdf(quote)` — pdf-worker
Genera un PDF de la cotización usando PDFKit. Retorna un Buffer.
