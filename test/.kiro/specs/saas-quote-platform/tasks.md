# Plan de Implementación: QuoteFast

## Visión General

Implementación incremental de la plataforma SaaS QuoteFast usando NestJS + PostgreSQL (Prisma) en el backend, Next.js en el frontend, y AWS Lambda + SQS para workers asíncronos. Cada tarea construye sobre la anterior y termina con integración funcional.

## Tareas

- [x] 1. Configuración del proyecto y estructura base
  - Inicializar proyecto NestJS con módulos: Auth, Clients, Quotes, QuoteItems, Public, Tracking, Templates, Dashboard
  - Configurar Prisma con el schema completo (User, Client, Quote, QuoteItem, TrackingEvent, Template)
  - Configurar variables de entorno (.env) para DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, AWS_REGION, SQS_QUEUE_URL, S3_BUCKET, SES_FROM_EMAIL
  - Instalar dependencias: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `@prisma/client`, `fast-check`
  - Configurar PrismaService como módulo global
  - _Requisitos: 1.1, 3.1, 12.1_

- [x] 2. Módulo de Autenticación
  - [x] 2.1 Implementar AuthService con registro, login y refresh de tokens
    - Hashear contraseñas con bcrypt (salt rounds: 12)
    - Generar JWT de acceso (15 min) y refresh token (7 días) con `@nestjs/jwt`
    - Almacenar hash del refresh token en User.refreshToken
    - Implementar guard `JwtAuthGuard` para proteger endpoints
    - _Requisitos: 1.1, 1.2, 1.3, 1.6_
  - [x] 2.2 Implementar AuthController con POST /api/auth/register, /login, /refresh
    - Validar DTOs con class-validator (email válido, contraseña mínimo 8 caracteres)
    - Retornar 401 en credenciales incorrectas sin revelar si el email existe (Requisito 1.4)
    - Retornar 409 si el email ya está registrado (Requisito 1.7)
    - _Requisitos: 1.1, 1.2, 1.4, 1.7_
  - [x] 2.3 Escribir tests unitarios para AuthService
    - Test: registro con email duplicado retorna 409
    - Test: login con contraseña incorrecta retorna 401
    - Test: refresh con token inválido retorna 401
    - _Requisitos: 1.4, 1.5, 1.7_

- [x] 3. Módulo de Clientes
  - [x] 3.1 Implementar ClientsService con CRUD completo
    - Todas las queries deben filtrar por `userId` del JWT (aislamiento multi-tenant)
    - Validar que el nombre no esté vacío en create/update
    - Verificar cotizaciones asociadas antes de eliminar (retornar 409 si existen)
    - Retornar lista paginada ordenada por createdAt DESC
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 3.2 Implementar ClientsController con GET/POST/PATCH/DELETE /api/clients
    - Proteger todos los endpoints con JwtAuthGuard
    - Retornar 404 si el cliente no existe o no pertenece al usuario
    - _Requisitos: 2.3, 12.1, 12.2_
  - [ ]* 3.3 Escribir test de propiedad para aislamiento de clientes
    - **Propiedad 10: Aislamiento de datos por usuario**
    - Generar dos usuarios con clientes propios, verificar que las queries de cada uno solo retornan sus propios clientes
    - **Valida: Requisitos 2.3, 12.1, 12.2**

- [x] 4. Lógica de cálculo de totales de cotización
  - [x] 4.1 Implementar función pura `calculateQuoteTotals` en `quotes/utils/calculate-totals.ts`
    - Firma: `calculateQuoteTotals(items, taxRate, discount): QuoteTotals`
    - Implementar: `subtotal = sum(qty * unitPrice)`, `taxAmount = subtotal * taxRate/100`, `total = subtotal + taxAmount - discount`
    - _Requisitos: 3.5, 3.6_
  - [ ]* 4.2 Escribir tests de propiedad para cálculo de totales (P1, P2, P3, P4)
    - **Propiedad 1: Corrección del subtotal** — `fc.array(fc.record({quantity: fc.float({min:0, max:1000}), unitPrice: fc.float({min:0, max:10000})}))` → verificar suma exacta
    - **Propiedad 2: Corrección del taxAmount** — `fc.float({min:0}), fc.float({min:0, max:100})` → verificar `subtotal * taxRate / 100`
    - **Propiedad 3: Corrección del total** — combinación de ítems + taxRate + descuento → verificar `subtotal + taxAmount - discount`
    - **Propiedad 4: Idempotencia del recálculo** — aplicar `calculateQuoteTotals` dos veces → mismo resultado
    - Mínimo 100 iteraciones por propiedad con fast-check
    - Tag: `Feature: saas-quote-platform, Property {N}: {texto}`
    - **Valida: Requisitos 3.5, 3.6**

- [x] 5. Módulo de Cotizaciones — CRUD y gestión de ítems
  - [x] 5.1 Implementar QuotesService con create, findAll, findOne, update, delete, duplicate
    - Al crear: generar `publicId` con `uuid()`, establecer estado DRAFT
    - Al crear/actualizar: verificar límite FREE (máximo 5 cotizaciones en el mes actual para plan FREE)
    - Todas las queries filtran por `userId`
    - Retornar 404 si la cotización no existe o no pertenece al usuario
    - _Requisitos: 3.1, 3.2, 3.3, 3.8, 3.9, 3.10, 8.1, 8.2, 8.3_
  - [x] 5.2 Implementar QuoteItemsService con create, update, delete
    - Después de cada operación sobre ítems, llamar a `calculateQuoteTotals` y actualizar los campos `subtotal`, `taxAmount`, `total` en la cotización
    - Rechazar operaciones sobre cotizaciones en estado ACCEPTED, REJECTED o EXPIRED (error 422)
    - _Requisitos: 3.4, 3.5, 3.6, 3.7_
  - [x] 5.3 Implementar QuotesController y QuoteItemsController
    - GET/POST/PATCH/DELETE /api/quotes
    - POST /api/quotes/:id/duplicate
    - POST/PATCH/DELETE /api/quotes/:id/items
    - Proteger con JwtAuthGuard
    - _Requisitos: 3.1, 3.4, 3.9_
  - [x] 5.4 Escribir test de propiedad para límite del plan FREE (P8)
    - **Propiedad 8: Límite del plan FREE**
    - Generar entre 1 y 10 intentos de creación para usuario FREE en el mismo mes, verificar que el error 403 aparece exactamente en el intento número 6
    - **Valida: Requisitos 8.1, 8.2, 8.3**
  - [x] 5.5 Escribir test de propiedad para inmutabilidad de estados terminales (P9)
    - **Propiedad 9: Inmutabilidad de cotizaciones terminales**
    - Para cotizaciones en ACCEPTED, REJECTED, EXPIRED: cualquier intento de update o delete de ítems debe retornar 422
    - **Valida: Requisito 3.7**
  - [x] 5.6 Escribir test de propiedad para unicidad del publicId (P7)
    - **Propiedad 7: Unicidad del publicId**
    - Crear N cotizaciones y verificar que todos los publicIds son distintos (sin colisiones)
    - **Valida: Requisito 3.2**
  - [x] 5.7 Escribir test de propiedad para consistencia de totales (P11)
    - **Propiedad 11: Consistencia de totales tras modificación de ítems**
    - Después de agregar/editar/eliminar ítems, los totales en DB deben coincidir con `calculateQuoteTotals(items)`
    - **Valida: Requisito 3.6**

- [x] 6. Checkpoint — Verificar tests de cálculos y CRUD
  - Asegurarse de que todos los tests pasen, consultar al usuario si surgen dudas.

- [x] 7. Módulo de Envío y Workers
  - [x] 7.1 Implementar QuotesSendService con lógica de envío
    - Validar que la cotización tenga al menos 1 ítem (error 422 si no)
    - Encolar mensaje en SQS con payload `{quoteId, type: "SEND_QUOTE"}`
    - Retornar 202 Accepted inmediatamente
    - _Requisitos: 4.1, 4.2, 4.3_
  - [x] 7.2 Implementar Lambda Worker para generación de PDF
    - Recibir mensaje SQS, fetch cotización completa de DB
    - Generar PDF con PDFKit o Puppeteer incluyendo: logo/empresa, datos cliente, tabla de ítems, totales, notas, términos
    - Subir PDF a S3, actualizar `pdfUrl` en la cotización
    - _Requisitos: 4.4, 11.1, 11.2_
  - [x] 7.3 Implementar Lambda Worker para envío de email
    - Enviar email via AWS SES con link público `https://app.quotefast.io/q/{publicId}`
    - Actualizar `status=SENT`, `sentAt=now()` en la cotización
    - Implementar reintentos con backoff exponencial (hasta 3 intentos, luego DLQ)
    - _Requisitos: 4.5, 4.6, 4.7_
  - [x] 7.4 Implementar POST /api/quotes/:id/send en QuotesController
    - _Requisitos: 4.1, 4.2_
  - [ ] 7.5 Escribir tests unitarios para workers
    - Test: worker con PDF fallido reintenta 3 veces
    - Test: cotización sin ítems retorna 422 al intentar enviar
    - _Requisitos: 4.2, 4.7_

- [x] 8. Módulo Público y Tracking
  - [x] 8.1 Implementar PublicQuotesService con findByPublicId
    - Retornar datos completos de la cotización sin información sensible del usuario
    - Retornar 404 si el publicId no existe
    - _Requisitos: 5.1, 5.2_
  - [x] 8.2 Implementar TrackingService con registerEvent
    - Al registrar QUOTE_OPENED: verificar si `viewedAt IS NULL`; si es así, actualizar `viewedAt=now()` y `status=VIEWED` (solo si estaba en SENT)
    - Si `viewedAt` ya tiene valor, registrar el TrackingEvent pero NO actualizar `viewedAt`
    - Registrar IP y User-Agent en cada evento
    - _Requisitos: 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 8.3 Implementar accept/reject en PublicQuotesService
    - Validar que el estado actual permita la transición (no ACCEPTED, REJECTED, EXPIRED)
    - Actualizar estado y fecha correspondiente (acceptedAt / rejectedAt)
    - Registrar TrackingEvent del tipo correspondiente
    - Notificar al usuario propietario via email (encolar en SQS)
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 8.4 Implementar PublicController
    - GET /api/public/quotes/:publicId (sin auth)
    - POST /api/public/quotes/:publicId/accept
    - POST /api/public/quotes/:publicId/reject
    - POST /api/public/track (para tracking de descarga de PDF)
    - _Requisitos: 5.1, 6.1, 6.2_
  - [x] 8.5 Escribir test de propiedad para viewedAt (P6)
    - **Propiedad 6: viewedAt se actualiza solo una vez**
    - Simular N aperturas (N entre 1 y 20) de la misma cotización, verificar que viewedAt tiene el valor de la primera apertura y no cambia
    - **Valida: Requisitos 5.4, 5.5**
  - [x] 8.6 Escribir test de propiedad para transiciones de estado (P5)
    - **Propiedad 5: Transiciones de estado válidas**
    - Para cotizaciones en ACCEPTED, REJECTED, EXPIRED: accept y reject deben retornar 422
    - **Valida: Requisitos 3.7, 6.4, 7.3**

- [x] 9. Worker de Expiración Automática
  - [x] 9.1 Implementar Lambda scheduled (EventBridge, cada hora) para expiración
    - Query: `UPDATE quotes SET status=EXPIRED WHERE validUntil < now() AND status NOT IN ('ACCEPTED', 'REJECTED', 'EXPIRED')`
    - Registrar TrackingEvent QUOTE_EXPIRED para cada cotización expirada
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_
  - [x] 9.2 Escribir test de propiedad para expiración (P12)
    - **Propiedad 12: Expiración no afecta estados terminales**
    - Para cotizaciones en ACCEPTED o REJECTED con validUntil en el pasado, ejecutar el proceso de expiración y verificar que el estado no cambia
    - **Valida: Requisito 7.3**
  - [x] 9.3 Escribir test de propiedad para expiración de no-terminales (P5 complemento)
    - Para cotizaciones en DRAFT, SENT, VIEWED con validUntil en el pasado, verificar que el proceso las marca como EXPIRED
    - **Valida: Requisito 7.1**

- [x] 10. Checkpoint — Verificar flujo completo de cotización
  - Asegurarse de que todos los tests pasen, consultar al usuario si surgen dudas.

- [x] 11. Dashboard y Métricas
  - [x] 11.1 Implementar DashboardService con agregaciones
    - Conteo de cotizaciones por estado (GROUP BY status WHERE userId = ?)
    - Valor del pipeline: `SUM(total) WHERE status IN ('SENT', 'VIEWED') AND userId = ?`
    - Tasa de conversión: `COUNT(ACCEPTED) / COUNT(SENT + VIEWED + ACCEPTED + REJECTED + EXPIRED) * 100`
    - Lista de cotizaciones recientes (últimas 10, con cliente y estado)
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_
  - [x] 11.2 Implementar GET /api/dashboard en DashboardController
    - Proteger con JwtAuthGuard
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_
  - [x] 11.3 Escribir tests de propiedad para métricas del dashboard (P relacionadas con 9.2, 9.3)
    - Generar conjuntos aleatorios de cotizaciones con estados variados, verificar que el pipeline y la tasa de conversión siguen las fórmulas definidas
    - **Valida: Requisitos 9.2, 9.3**

- [x] 12. Módulo de Plantillas
  - [x] 12.1 Implementar TemplatesService con CRUD
    - Filtrar por userId en todas las queries
    - Para plan TEAM/BUSINESS: incluir plantillas del equipo (mismo teamId o userId compartido)
    - Seed de 2 plantillas predeterminadas del sistema (userId = null, isDefault = true)
    - _Requisitos: 10.1, 10.2, 10.3, 10.5_
  - [x] 12.2 Implementar TemplatesController con GET/POST/PATCH/DELETE /api/templates
    - Proteger con JwtAuthGuard
    - _Requisitos: 10.1, 10.2_
  - [x] 12.3 Implementar lógica de crear cotización desde plantilla
    - POST /api/quotes con `templateId` en el body pre-pobla los campos
    - _Requisitos: 10.4_

- [x] 13. Frontend — Estructura base Next.js
  - [x] 13.1 Configurar proyecto Next.js con TanStack Query, Tailwind CSS y estructura de carpetas
    - Configurar `QueryClient` con staleTime y retry apropiados
    - Configurar interceptor de axios/fetch para adjuntar JWT y manejar refresh automático
    - Crear layout base con sidebar de navegación
    - _Requisitos: 1.2, 1.3_
  - [x] 13.2 Implementar páginas de autenticación (login y registro)
    - Formularios con validación client-side
    - Almacenar tokens en httpOnly cookies o memory (no localStorage)
    - Redirect a dashboard tras login exitoso
    - _Requisitos: 1.1, 1.2_

- [x] 14. Frontend — Dashboard y lista de cotizaciones
  - [x] 14.1 Implementar página de Dashboard con métricas
    - Cards con conteo por estado, valor del pipeline, tasa de conversión
    - Lista de cotizaciones recientes con estado, cliente y total
    - Usar TanStack Query para fetch de `/api/dashboard`
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_
  - [x] 14.2 Implementar página de lista de cotizaciones con filtros por estado
    - Paginación, filtro por estado, ordenamiento
    - _Requisitos: 3.10_

- [x] 15. Frontend — Creación y edición de cotizaciones
  - [x] 15.1 Implementar formulario inline de cotización (no wizard)
    - Campos: título, cliente (select), moneda, validUntil, notas, términos
    - Tabla de ítems editable inline con agregar/eliminar filas
    - Auto-save cada 5 segundos con debounce (PATCH /api/quotes/:id)
    - _Requisitos: 3.1, 3.4_
  - [x] 15.2 Implementar cálculo de totales en tiempo real en el frontend
    - Recalcular subtotal, taxAmount y total al cambiar cualquier ítem (sin esperar al servidor)
    - Mostrar totales actualizados instantáneamente
    - _Requisitos: 3.5, 3.6_
  - [x] 15.3 Implementar botón de envío con validación
    - Deshabilitar si no hay ítems
    - Mostrar estado de envío (loading, success, error)
    - _Requisitos: 4.1, 4.2_

- [x] 16. Frontend — Vista pública de cotización
  - [x] 16.1 Implementar página pública `/q/[publicId]` (sin auth requerida)
    - Diseño profesional con logo, datos del cliente, tabla de ítems, totales
    - Botones de Aceptar y Rechazar (ocultos si estado es terminal)
    - Botón de descarga de PDF
    - _Requisitos: 5.1, 6.1, 6.2_
  - [x] 16.2 Implementar tracking de apertura al cargar la página pública
    - POST /api/public/track al montar el componente
    - _Requisitos: 5.3, 5.7_

- [x] 17. Frontend — Gestión de clientes y plantillas
  - [x] 17.1 Implementar CRUD de clientes con formulario modal
    - _Requisitos: 2.1, 2.2_
  - [x] 17.2 Implementar CRUD de plantillas con selector en formulario de cotización
    - _Requisitos: 10.1, 10.4, 10.5_

- [x] 18. Infraestructura Terraform
  - [x] 18.1 Crear módulos Terraform para VPC, subnets privadas, security groups
    - _Requisitos: 12.3, 12.4_
  - [x] 18.2 Crear recursos ECS Fargate para la API NestJS
    - Task definition, service, ALB, target group
    - _Requisitos: 4.3_
  - [x] 18.3 Crear recursos Lambda + SQS para workers (PDF, email, expiración)
    - SQS queue con DLQ, Lambda functions con triggers SQS y EventBridge
    - _Requisitos: 4.3, 4.7, 7.2_
  - [x] 18.4 Crear recursos RDS PostgreSQL, S3 bucket, SES configuration
    - _Requisitos: 4.4, 11.2_

- [x] 19. Checkpoint final — Todos los tests deben pasar
  - Ejecutar suite completa de tests unitarios y de propiedades.
  - Asegurarse de que todos los tests pasen, consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los tests de propiedades usan `fast-check` con mínimo 100 iteraciones
- Los workers Lambda se implementan como funciones independientes en `/workers/`
- El frontend usa httpOnly cookies para tokens JWT (seguridad contra XSS)
