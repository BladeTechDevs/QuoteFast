# Documento Formal de Requerimientos
## QuoteFast — Sistema de Gestión de Cotizaciones Profesionales

| Campo | Valor |
|-------|-------|
| Versión | 1.0.0 |
| Fecha | Marzo 2026 |
| Estado | Aprobado |
| Clasificación | Interno |

---

## 1. Introducción

### 1.1 Propósito

Este documento describe los requerimientos funcionales y no funcionales del sistema QuoteFast, una plataforma SaaS para la creación, envío, seguimiento y firma electrónica de cotizaciones profesionales. Sirve como referencia oficial del alcance del sistema en su versión actual.

### 1.2 Alcance

QuoteFast permite a freelancers, agencias y empresas de servicios:

- Crear y gestionar cotizaciones con ítems de línea detallados
- Enviar cotizaciones a clientes mediante un link público único
- Rastrear el comportamiento del cliente (apertura, descarga, decisión)
- Recibir aceptación, rechazo o firma electrónica del cliente
- Gestionar una base de clientes y plantillas reutilizables
- Personalizar la identidad visual de las cotizaciones (branding)
- Consultar métricas de conversión y pipeline en un dashboard

### 1.3 Definiciones y Acrónimos

| Término | Definición |
|---------|-----------|
| Cotización | Documento comercial que detalla productos o servicios con precios |
| publicId | Identificador UUID único para acceso público a una cotización |
| Estado terminal | Estado de cotización que no puede cambiar: ACCEPTED, REJECTED, EXPIRED |
| Soft delete | Eliminación lógica mediante campo `deletedAt`, sin borrar el registro |
| Plan FREE | Nivel de suscripción gratuito con límite de 5 cotizaciones por mes |
| JWT | JSON Web Token, mecanismo de autenticación sin estado |
| SQS | AWS Simple Queue Service, cola de mensajes para procesamiento asíncrono |
| SES | AWS Simple Email Service, servicio de envío de emails |
| S3 | AWS Simple Storage Service, almacenamiento de archivos |
| DLQ | Dead Letter Queue, cola para mensajes fallidos |
| PBT | Property-Based Testing, metodología de pruebas con propiedades formales |

### 1.4 Referencias

- Arquitectura del sistema: `docs/arquitectura.md`
- Esquema de base de datos: `docs/base-de-datos.md`
- Referencia de API: `docs/api-backend.md`
- Referencia de funciones: `docs/funciones.md`

---

## 2. Descripción General del Sistema

### 2.1 Perspectiva del Producto

QuoteFast es una aplicación web full-stack compuesta por:

- **Frontend**: Next.js 14 (App Router), accesible desde el navegador
- **Backend**: API REST NestJS 10 desplegado en ECS Fargate, expuesto via Amazon API Gateway
- **Base de datos**: PostgreSQL 16 en Amazon RDS (db.t3.micro, Single-AZ) gestionada con Prisma ORM
- **Secretos**: AWS Secrets Manager (cadena de conexión DB, JWT secret, JWT refresh secret)
- **Red**: NAT Gateway para tráfico saliente desde subnets privadas
- **Procesamiento asíncrono**: Workers Lambda que consumen mensajes de AWS SQS
- **Almacenamiento**: AWS S3 Standard para PDFs generados
- **Email**: AWS SES para notificaciones transaccionales

### 2.2 Funciones Principales del Sistema

1. Autenticación y gestión de usuarios con planes de suscripción
2. Gestión de clientes (directorio de contactos)
3. Ciclo de vida completo de cotizaciones (DRAFT → SENT → VIEWED → ACCEPTED/REJECTED/EXPIRED)
4. Firma electrónica de cotizaciones
5. Rastreo de interacciones del cliente
6. Plantillas de cotización reutilizables
7. Personalización de marca (branding)
8. Dashboard de métricas y análisis

### 2.3 Clases de Usuarios

| Clase | Descripción |
|-------|-------------|
| Usuario FREE | Acceso completo con límite de 5 cotizaciones por mes |
| Usuario PRO | Sin límite de cotizaciones |
| Usuario TEAM | Sin límite, con acceso a plantillas compartidas del equipo |
| Usuario BUSINESS | Sin límite, máximas capacidades |
| Cliente (externo) | Accede a cotizaciones vía link público, sin cuenta en el sistema |

### 2.4 Restricciones Generales

- El sistema requiere Node.js 20+ para ejecutarse
- La base de datos debe ser PostgreSQL 16
- Las funcionalidades de email y PDF requieren credenciales AWS activas
- En ausencia de credenciales AWS, el sistema opera en modo degradado (sin emails ni PDFs reales)

---

## 3. Requerimientos Funcionales

### RF-01: Registro de Usuario

**Descripción:** El sistema debe permitir el registro de nuevos usuarios.

**Precondiciones:** El email no debe estar registrado previamente.

**Flujo principal:**
1. El usuario envía nombre, email y contraseña
2. El sistema verifica que el email no esté en uso
3. El sistema hashea la contraseña con bcrypt (12 rondas)
4. El sistema crea el usuario con plan FREE por defecto
5. El sistema genera y retorna un par de tokens JWT (access + refresh)

**Postcondiciones:** El usuario queda autenticado y puede operar el sistema.

**Errores:**
- `409 Conflict` si el email ya está registrado

---

### RF-02: Autenticación de Usuario

**Descripción:** El sistema debe autenticar usuarios mediante email y contraseña.

**Flujo principal:**
1. El usuario envía email y contraseña
2. El sistema verifica las credenciales sin revelar si el email existe
3. El sistema genera un access token (15 min) y un refresh token (7 días)
4. El sistema almacena el hash del refresh token en la base de datos

**Errores:**
- `401 Unauthorized` si las credenciales son inválidas
- Rate limit: máximo 5 intentos por minuto

---

### RF-03: Renovación de Token

**Descripción:** El sistema debe permitir renovar el access token usando el refresh token.

**Flujo principal:**
1. El cliente envía el refresh token
2. El sistema verifica la firma y busca el usuario
3. El sistema compara el token con el hash almacenado
4. El sistema genera un nuevo par de tokens

**Errores:**
- `401 Unauthorized` si el token es inválido, expirado o no coincide con el hash

---

### RF-04: Cierre de Sesión

**Descripción:** El sistema debe invalidar la sesión del usuario.

**Flujo principal:**
1. El usuario autenticado solicita logout
2. El sistema establece `refreshToken = null` en la base de datos
3. Cualquier intento de refresh posterior falla

---

### RF-05: Consulta de Uso del Plan

**Descripción:** El sistema debe informar al usuario cuántas cotizaciones ha creado en el mes actual y cuántas le quedan según su plan.

**Respuesta incluye:** `plan`, `quotesThisMonth`, `quotesLimit`, `quotesRemaining`, `periodStart`, `periodEnd`.

**Nota:** Para planes PRO, TEAM y BUSINESS, `quotesLimit` y `quotesRemaining` son `null` (sin límite).

---

### RF-06: Gestión de Clientes

**Descripción:** El sistema debe permitir al usuario gestionar un directorio de clientes.

**Operaciones:**
- **Crear:** nombre (requerido), email, empresa, teléfono, dirección, notas (todos opcionales excepto nombre)
- **Listar:** paginado, ordenado por fecha de creación descendente
- **Obtener:** por ID, verificando ownership
- **Actualizar:** actualización parcial de cualquier campo
- **Eliminar:** solo si el cliente no tiene cotizaciones asociadas

**Restricciones:**
- Un cliente no puede eliminarse si tiene cotizaciones asociadas (`409 Conflict`)
- Un usuario solo puede ver y modificar sus propios clientes

---

### RF-07: Creación de Cotización

**Descripción:** El sistema debe permitir crear cotizaciones en estado DRAFT.

**Campos requeridos:** título

**Campos opcionales:** clientId, currency (default: USD), taxRate, discount, notes, terms, validUntil, templateId

**Comportamiento con templateId:** Si se provee un `templateId`, los campos no especificados en el request se toman del contenido del template como valores por defecto.

**Restricciones:**
- Usuarios en plan FREE no pueden superar 5 cotizaciones por mes calendario
- `403 Forbidden` si se supera el límite del plan FREE

---

### RF-08: Listado y Búsqueda de Cotizaciones

**Descripción:** El sistema debe listar las cotizaciones del usuario con capacidades de filtrado y paginación.

**Parámetros de query:**
- `page`, `limit` (paginación)
- `status` (filtro por estado)
- `search` (búsqueda por título, case-insensitive)
- `sortBy`, `sortOrder` (ordenamiento)

**Restricciones:** Las cotizaciones con soft delete (`deletedAt != null`) no aparecen en el listado.

---

### RF-09: Actualización de Cotización

**Descripción:** El sistema debe permitir actualizar los campos de una cotización.

**Campos actualizables:** título, clientId, currency, taxRate, discount, notes, terms, validUntil

**Restricciones:** Solo el dueño puede actualizar su cotización.

---

### RF-10: Eliminación de Cotización

**Descripción:** El sistema debe implementar soft delete en cotizaciones.

**Comportamiento:** Establece `deletedAt = now()`. El registro permanece en la base de datos para auditoría. La cotización desaparece de todos los listados.

---

### RF-11: Duplicación de Cotización

**Descripción:** El sistema debe permitir duplicar una cotización existente.

**Comportamiento:**
- Crea una nueva cotización con título `"[título original] (copy)"` en estado DRAFT
- Copia todos los ítems de la cotización original
- La nueva cotización no hereda estados, fechas de envío ni firma

**Restricciones:** Aplica el límite del plan FREE.

---

### RF-12: Recálculo de Totales

**Descripción:** El sistema debe recalcular los totales de una cotización a demanda.

**Comportamiento:** Recalcula el `total` de cada ítem y los totales globales (subtotal, taxAmount, total) usando las fórmulas de cálculo estándar.

**Restricciones:** No aplica a cotizaciones en estados terminales.

---

### RF-13: Envío de Cotización

**Descripción:** El sistema debe permitir enviar una cotización al cliente.

**Precondiciones:**
- La cotización debe existir y pertenecer al usuario
- La cotización debe tener al menos un ítem

**Flujo principal:**
1. El sistema actualiza el estado a `SENT` y registra `sentAt`
2. Si AWS está configurado, encola un job `SEND_QUOTE` en SQS
3. El worker Lambda genera el PDF y envía el email con el link público

**Errores:**
- `404 Not Found` si la cotización no existe
- `422 Unprocessable Entity` si la cotización no tiene ítems

---

### RF-14: Gestión de Ítems de Cotización

**Descripción:** El sistema debe permitir agregar, modificar y eliminar ítems de una cotización.

**Campos de un ítem:** nombre (requerido), descripción, cantidad, precio unitario, descuento por ítem, tasa de impuesto por ítem, costo interno (no visible al cliente), orden

**Comportamiento:** Cada operación sobre un ítem recalcula automáticamente los totales de la cotización.

**Restricciones:**
- No se pueden modificar ítems de cotizaciones en estados terminales (ACCEPTED, REJECTED, EXPIRED)
- El campo `internalCost` nunca se expone en la vista pública

---

### RF-15: Vista Pública de Cotización

**Descripción:** El sistema debe proveer una vista pública de la cotización accesible sin autenticación mediante un link único.

**URL:** `/q/{publicId}`

**Contenido expuesto:** título, estado, moneda, ítems (sin internalCost), totales, notas, términos, fecha de validez, datos del emisor, datos del cliente, firma (si existe), branding del emisor

**Comportamiento:** Al acceder, el sistema registra automáticamente un evento `QUOTE_OPENED` de forma asíncrona.

---

### RF-16: Aceptación de Cotización por el Cliente

**Descripción:** El cliente debe poder aceptar una cotización desde la vista pública.

**Precondiciones:** La cotización no debe estar en estado terminal.

**Flujo:**
1. El sistema actualiza el estado a `ACCEPTED` y registra `acceptedAt`
2. Registra evento `QUOTE_ACCEPTED` con IP y user-agent
3. Si AWS está configurado, notifica al dueño por email

**Errores:**
- `422 Unprocessable Entity` si la cotización ya está en estado terminal

---

### RF-17: Rechazo de Cotización por el Cliente

**Descripción:** El cliente debe poder rechazar una cotización desde la vista pública.

**Comportamiento:** Igual que RF-16 pero con estado `REJECTED`, `rejectedAt` y evento `QUOTE_REJECTED`.

---

### RF-18: Firma Electrónica de Cotización

**Descripción:** El cliente debe poder firmar electrónicamente una cotización desde la vista pública.

**Datos requeridos:** nombre del firmante

**Datos opcionales:** imagen de firma (base64 data URI)

**Validaciones:**
- El nombre del firmante no puede estar vacío ni superar 255 caracteres
- La imagen de firma debe ser un data URI base64 válido (png, jpeg, jpg, webp)
- La imagen no puede superar 5 MB

**Precondiciones:** La cotización debe estar en estado `SENT` o `VIEWED`.

**Flujo (transacción atómica):**
1. Crea o actualiza el registro de firma
2. Actualiza el estado de la cotización a `ACCEPTED`
3. Registra `signedAt` y `acceptedAt`
4. Registra evento `QUOTE_ACCEPTED` con metadata `{ via: 'signature' }`

**Errores:**
- `400 Bad Request` si los datos de firma son inválidos
- `404 Not Found` si la cotización no existe
- `409 Conflict` si la cotización no está en estado firmable

---

### RF-19: Rastreo de Eventos

**Descripción:** El sistema debe registrar las interacciones del cliente con la cotización.

**Eventos rastreados:**

| Evento | Disparador |
|--------|-----------|
| `QUOTE_OPENED` | Cliente abre el link público |
| `QUOTE_VIEWED` | Alias de apertura (registrado por el sistema) |
| `QUOTE_ACCEPTED` | Cliente acepta o firma |
| `QUOTE_REJECTED` | Cliente rechaza |
| `QUOTE_PDF_DOWNLOADED` | Cliente descarga el PDF |
| `QUOTE_EXPIRED` | Cron job marca la cotización como expirada |

**Datos registrados por evento:** quoteId, eventType, ipAddress, userAgent, metadata (JSON), timestamp

**Comportamiento especial de `QUOTE_OPENED`:** Si es la primera apertura (`viewedAt === null`), actualiza `viewedAt` en la cotización y, si estaba en `SENT`, cambia el estado a `VIEWED`.

---

### RF-20: Expiración Automática de Cotizaciones

**Descripción:** El sistema debe marcar automáticamente como expiradas las cotizaciones vencidas.

**Trigger:** Cron job diario a las 9:00 AM UTC

**Criterio:** Cotizaciones en estado `SENT` o `VIEWED` cuya `validUntil` sea anterior a la fecha actual.

**Acción:** Actualiza el estado a `EXPIRED` en una sola operación `updateMany`.

---

### RF-21: Recordatorios Automáticos

**Descripción:** El sistema debe enviar recordatorios automáticos para cotizaciones no vistas.

**Trigger:** Cron job diario a las 9:00 AM UTC

**Criterio:** Cotizaciones en estado `SENT`, con `viewedAt = null`, enviadas hace más de 3 días.

**Acción:** Encola un job `SEND_EMAIL` en SQS por cada cotización que cumpla el criterio.

---

### RF-22: Gestión de Plantillas

**Descripción:** El sistema debe permitir gestionar plantillas de cotización reutilizables.

**Tipos de plantillas:**
- **Del sistema** (`isDefault = true, userId = null`): visibles para todos los usuarios, no modificables
- **Del usuario** (`userId = <id>`): propias de cada usuario, modificables y eliminables

**Plantillas del sistema disponibles al inicio:**
1. "Propuesta de Servicios Profesionales" (USD, 16% IVA)
2. "Propuesta de Desarrollo de Software" (USD, 0% IVA)

**Operaciones:** crear, listar (propias + sistema), obtener, actualizar (solo propias), eliminar (solo propias)

---

### RF-23: Configuración de Branding

**Descripción:** El sistema debe permitir al usuario personalizar la identidad visual de sus cotizaciones.

**Campos configurables:** logoUrl, primaryColor, accentColor, footerText, companyName

**Valores por defecto:** `primaryColor: '#2563eb'`, `accentColor: '#1d4ed8'`

**Comportamiento:** La configuración de branding se aplica automáticamente en la vista pública de todas las cotizaciones del usuario.

---

### RF-24: Dashboard de Métricas

**Descripción:** El sistema debe proveer métricas de negocio al usuario.

**Métricas disponibles:**

| Métrica | Descripción |
|---------|-------------|
| `quotesByStatus` | Conteo de cotizaciones por cada estado |
| `pipelineValue` | Suma total de cotizaciones en SENT + VIEWED |
| `avgQuoteValue` | Valor promedio de cotizaciones en pipeline |
| `conversionRate` | % de cotizaciones aceptadas sobre el total enviado |
| `openRate` | % de cotizaciones vistas sobre el total enviado |
| `avgDaysToAccept` | Promedio de días entre envío y aceptación |
| `recentQuotes` | Últimas 10 cotizaciones con cliente |

---

## 4. Requerimientos No Funcionales

### RNF-01: Rendimiento

- El backend debe responder en menos de 500ms para el 95% de las requests bajo carga normal
- Las queries de dashboard se ejecutan en paralelo para minimizar latencia
- El listado de cotizaciones soporta paginación para evitar cargas masivas

### RNF-02: Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt (12 rondas de sal)
- Los refresh tokens se almacenan como hash bcrypt, nunca en texto plano
- Los access tokens expiran en 15 minutos
- Los refresh tokens expiran en 7 días
- El campo `internalCost` de los ítems nunca se expone en endpoints públicos
- Todos los endpoints privados requieren JWT válido
- Los headers de seguridad HTTP se aplican globalmente con `helmet`
- CORS restringido al dominio del frontend configurado en `FRONTEND_URL`
- Tamaño máximo de request: 1 MB
- Rate limiting global: 20 req/seg, 300 req/min
- Rate limiting estricto en login: 5 intentos/min

### RNF-03: Disponibilidad

- El sistema debe estar disponible 99.5% del tiempo en producción
- En ausencia de credenciales AWS, el sistema opera en modo degradado (sin emails ni PDFs) sin caídas

### RNF-04: Escalabilidad

- El backend se despliega en ECS Fargate (1 tarea continua, 730 h/mes) en subnet privada
- El acceso externo se gestiona a través de Amazon API Gateway (HTTP API)
- El tráfico de salida de la subnet privada pasa por NAT Gateway
- El procesamiento asíncrono via SQS desacopla el envío de emails y PDFs del ciclo de request/response
- La base de datos tiene índices en los campos de mayor consulta: `userId`, `status`, `deletedAt`

### RNF-05: Mantenibilidad

- El código está organizado en módulos NestJS independientes por dominio
- Las migraciones de base de datos están versionadas con Prisma Migrate
- La API está documentada con Swagger/OpenAPI (disponible en `/api/docs` en desarrollo)
- Los tests incluyen Property-Based Testing (PBT) con `fast-check` para validar propiedades formales

### RNF-06: Trazabilidad

- Todas las interacciones del cliente con una cotización quedan registradas en `TrackingEvent`
- Las cotizaciones eliminadas se conservan con soft delete para auditoría
- Los timestamps de cada transición de estado se registran en campos dedicados (`sentAt`, `viewedAt`, `acceptedAt`, `rejectedAt`, `signedAt`)

### RNF-07: Portabilidad

- El backend se distribuye como imagen Docker multi-etapa
- La infraestructura está definida como código con Terraform
- Las variables de entorno siguen el estándar 12-factor app

---

## 5. Requerimientos de Interfaz

### 5.1 Interfaz de Usuario

- Aplicación web responsive accesible desde navegadores modernos
- Autenticación persistente mediante cookies seguras (no localStorage)
- Renovación automática de tokens en segundo plano (interceptor Axios)
- Vista pública de cotización accesible sin cuenta ni autenticación

### 5.2 Interfaz de API

- API REST con prefijo `/api`
- Formato de datos: JSON
- Autenticación: Bearer Token (JWT)
- Documentación: OpenAPI 3.0 en `/api/docs`
- Validación de entrada: `class-validator` con whitelist estricta

### 5.3 Interfaz de Base de Datos

- Acceso exclusivo via Prisma ORM
- Conexión gestionada por `PrismaService` (singleton NestJS)
- Transacciones Prisma para operaciones que requieren atomicidad (ej: firma electrónica)

### 5.4 Interfaz con Servicios Externos

| Servicio | Protocolo | Propósito |
|----------|-----------|-----------|
| Amazon API Gateway | HTTPS | Punto de entrada público a la API |
| NAT Gateway | — | Tráfico saliente desde subnets privadas |
| AWS SQS | HTTPS / SDK | Encolar jobs de email y PDF |
| AWS SES | HTTPS / SDK | Envío de emails transaccionales |
| AWS S3 | HTTPS / SDK | Almacenamiento de PDFs |
| AWS Secrets Manager | HTTPS / SDK | Gestión de secretos (DB URL, JWT keys) |

---

## 6. Restricciones del Sistema

### 6.1 Restricciones de Negocio

- El plan FREE permite máximo 5 cotizaciones por mes calendario
- Los clientes con cotizaciones asociadas no pueden eliminarse
- Los ítems de cotizaciones en estados terminales no pueden modificarse
- Las plantillas del sistema no pueden modificarse ni eliminarse por usuarios

### 6.2 Restricciones Técnicas

- La imagen de firma electrónica no puede superar 5 MB
- El nombre del firmante no puede superar 255 caracteres
- El tamaño máximo de cualquier request es 1 MB
- Los PDFs se generan de forma asíncrona (no en tiempo real en el request)

---

## 7. Casos de Uso Principales

### CU-01: Freelancer envía cotización a cliente

1. Usuario crea cotización en DRAFT con ítems de servicio
2. Usuario hace clic en "Enviar"
3. Sistema cambia estado a SENT y encola job en SQS
4. Lambda genera PDF y envía email con link público
5. Cliente abre el link → estado cambia a VIEWED
6. Cliente acepta → estado cambia a ACCEPTED
7. Sistema notifica al usuario por email

### CU-02: Cliente firma electrónicamente

1. Cliente recibe link de cotización
2. Cliente abre el link → estado VIEWED
3. Cliente dibuja su firma y escribe su nombre
4. Sistema valida la firma, crea registro en `Signature`
5. Sistema actualiza estado a ACCEPTED en transacción atómica
6. Sistema registra evento de tracking con metadata de firma

### CU-03: Cotización expira automáticamente

1. Usuario envía cotización con `validUntil` en 30 días
2. Cron job diario verifica cotizaciones vencidas
3. Sistema marca la cotización como EXPIRED
4. La cotización ya no puede ser aceptada ni rechazada

### CU-04: Usuario analiza su pipeline

1. Usuario accede al dashboard
2. Sistema ejecuta 4 queries en paralelo
3. Sistema calcula conversion rate, open rate y días promedio de aceptación
4. Usuario visualiza el estado de su negocio

---

## 8. Infraestructura y Costos

### 8.1 Servicios AWS (us-east-1)

| Servicio | Configuración | Costo mensual |
|----------|--------------|--------------|
| AWS Fargate | Linux x86, 1 tarea, 730 h/mes, 20 GB efímero | $9.01 |
| Amazon RDS PostgreSQL | db.t3.micro, 20 GB gp2, Single-AZ, OnDemand | $37.34 |
| NAT Gateway | 1 gateway regional, 1 AZ | $32.89 |
| AWS Secrets Manager | 3 secretos, 1 000 llamadas API/mes | $1.21 |
| Amazon API Gateway | HTTP API, 10 000 req/mes | $0.01 |
| Amazon SES | 100 emails/mes | $0.01 |
| S3 Standard | 0.25 GB/mes | $0.01 |
| AWS SQS | ~200 mensajes/mes | $0.00 |
| AWS Lambda | 200 invocaciones/mes | $0.00 |
| Data Transfer | 1 GB saliente/mes | $0.00 |
| **Total** | | **$80.48 / mes** |

Costo anual estimado: **$965.76 USD**. Costo inicial: $0.00 (sin reservas).

> Fuente: [Calculadora de precios AWS](https://calculator.aws/#/estimate?id=9c5ddfedfac47bb09ca50b74fcba4896bc733e69) — Marzo 2026. No incluye impuestos.

### 8.2 Secretos gestionados

| Secreto | Propósito |
|---------|-----------|
| `quotefast/prod/database-url` | Cadena de conexión a RDS PostgreSQL |
| `quotefast/prod/jwt-secret` | Firma de access tokens |
| `quotefast/prod/jwt-refresh-secret` | Firma de refresh tokens |

---

## 9. Historial de Versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0.0 | Marzo 2026 | Versión inicial — baseline del sistema implementado |
| 1.1.0 | Marzo 2026 | Actualización de infraestructura AWS según estimación de costos oficial |
