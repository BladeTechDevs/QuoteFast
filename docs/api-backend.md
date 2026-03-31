# API Backend

Framework: **NestJS 10** | Lenguaje: **TypeScript** | Puerto: `3001`

Swagger UI disponible en `http://localhost:3001/api/docs` (solo en desarrollo).

Todos los endpoints tienen el prefijo `/api`.

## Autenticación

JWT Bearer Token. Incluir en el header:
```
Authorization: Bearer <access_token>
```

Los tokens de acceso expiran. Usar el endpoint de refresh para renovarlos.

---

## Módulos y Endpoints

### Auth — `/api/auth`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Registrar nuevo usuario |
| POST | `/auth/login` | No | Iniciar sesión |
| POST | `/auth/refresh` | No | Renovar access token |
| GET | `/auth/me` | Sí | Obtener usuario actual |
| POST | `/auth/logout` | Sí | Cerrar sesión |

**Register body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 8 chars)"
}
```

**Login body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Login response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": { "id", "email", "name", "company", "plan" }
}
```

---

### Clients — `/api/clients`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/clients` | Sí | Listar clientes (paginado) |
| POST | `/clients` | Sí | Crear cliente |
| GET | `/clients/:id` | Sí | Obtener cliente |
| PATCH | `/clients/:id` | Sí | Actualizar cliente |
| DELETE | `/clients/:id` | Sí | Eliminar cliente |

---

### Quotes — `/api/quotes`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/quotes` | Sí | Listar cotizaciones (paginado, filtrable) |
| POST | `/quotes` | Sí | Crear cotización |
| GET | `/quotes/:id` | Sí | Obtener cotización con ítems |
| PATCH | `/quotes/:id` | Sí | Actualizar cotización |
| DELETE | `/quotes/:id` | Sí | Soft delete |
| POST | `/quotes/:id/send` | Sí | Enviar cotización (DRAFT → SENT) |
| POST | `/quotes/:id/duplicate` | Sí | Duplicar cotización |

**Límite plan FREE:** máximo 5 cotizaciones por mes.

---

### Quote Items — `/api/quotes/:quoteId/items`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/quotes/:quoteId/items` | Sí | Agregar ítem |
| PATCH | `/quotes/:quoteId/items/:id` | Sí | Actualizar ítem |
| DELETE | `/quotes/:quoteId/items/:id` | Sí | Eliminar ítem |
| PUT | `/quotes/:quoteId/items/reorder` | Sí | Reordenar ítems |

---

### Templates — `/api/templates`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/templates` | Sí | Listar plantillas |
| POST | `/templates` | Sí | Crear plantilla |
| PATCH | `/templates/:id` | Sí | Actualizar plantilla |
| DELETE | `/templates/:id` | Sí | Eliminar plantilla |

---

### Dashboard — `/api/dashboard`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/dashboard/metrics` | Sí | Métricas del usuario |

---

### Branding — `/api/branding`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/branding` | Sí | Obtener configuración de marca |
| PUT | `/branding` | Sí | Crear o actualizar marca |

---

### Notifications — `/api/notifications`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/notifications` | Sí | Listar notificaciones (últimas 50) |
| GET | `/notifications?unread=true` | Sí | Solo notificaciones no leídas |
| GET | `/notifications/unread-count` | Sí | Cantidad de no leídas |
| PATCH | `/notifications/:id/read` | Sí | Marcar una como leída |
| PATCH | `/notifications/read-all` | Sí | Marcar todas como leídas |

---

### Public — `/api/public` (sin autenticación)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/public/quotes/:publicId` | No | Ver cotización pública |
| POST | `/public/quotes/:publicId/sign` | No | Firmar cotización |
| POST | `/public/quotes/:publicId/accept` | No | Aceptar cotización |
| POST | `/public/quotes/:publicId/reject` | No | Rechazar cotización |

---

## Rate Limiting

- **Short:** 20 requests / segundo
- **Long:** 300 requests / minuto

Los endpoints públicos tienen límites más estrictos via `ThrottlePublicGuard`.

## Seguridad

- `helmet` — headers de seguridad HTTP
- `compression` — compresión gzip
- Tamaño máximo de request: `1mb`
- CORS restringido a `FRONTEND_URL` (+ localhost en desarrollo)
- Contraseñas hasheadas con `bcrypt`
- Validación estricta con `class-validator` (whitelist + forbidNonWhitelisted)
