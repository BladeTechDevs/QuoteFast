# API Reference

Base URL: `http://localhost:3000/api`

La documentación interactiva Swagger está disponible en `http://localhost:3000/api/docs` cuando el servidor está corriendo.

## Autenticación

Las rutas protegidas requieren el header:
```
Authorization: Bearer <access_token>
```

Los tokens de acceso expiran en **15 minutos**. Usa el endpoint de refresh para renovarlos.

---

## Auth

### POST /auth/register
Registra un nuevo usuario.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña_segura",
  "name": "Nombre Apellido"
}
```

**Response 201:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "email": "...", "name": "...", "plan": "FREE" }
}
```

---

### POST /auth/login
Inicia sesión.

**Body:**
```json
{ "email": "usuario@ejemplo.com", "password": "contraseña" }
```

**Response 200:** igual que register.

---

### POST /auth/refresh
Renueva el access token.

**Body:**
```json
{ "refreshToken": "..." }
```

---

### POST /auth/logout
Invalida el refresh token. Requiere autenticación.

---

## Quotes (Protegido)

### POST /quotes
Crea una cotización.

**Body:**
```json
{
  "title": "Propuesta de desarrollo web",
  "clientId": "uuid-opcional",
  "currency": "USD",
  "taxRate": 16,
  "discount": 0,
  "notes": "Notas para el cliente",
  "terms": "Términos y condiciones",
  "validUntil": "2026-04-30T00:00:00Z",
  "templateId": "uuid-opcional"
}
```

---

### GET /quotes
Lista cotizaciones del usuario autenticado.

**Query params:**
- `status` — filtra por estado (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, SIGNED)
- `search` — búsqueda por título o cliente
- `page` — página (default: 1)
- `limit` — resultados por página (default: 20)

---

### GET /quotes/:id
Obtiene una cotización con sus ítems y firma.

---

### PATCH /quotes/:id
Actualiza campos de una cotización (solo en estado DRAFT).

---

### DELETE /quotes/:id
Soft delete de una cotización.

---

### POST /quotes/:id/duplicate
Duplica una cotización como nuevo DRAFT.

---

### POST /quotes/:id/send
Envía la cotización al cliente. Cambia estado a SENT y encola job en SQS.

**Response:** 202 Accepted

---

## Quote Items (Protegido)

### POST /quotes/:quoteId/items
Agrega un ítem a la cotización.

**Body:**
```json
{
  "name": "Diseño UI",
  "description": "Diseño de pantallas",
  "quantity": 1,
  "unitPrice": 1500.00,
  "order": 1
}
```

---

### PATCH /quotes/:quoteId/items/:itemId
Actualiza un ítem.

---

### DELETE /quotes/:quoteId/items/:itemId
Elimina un ítem y recalcula totales.

---

### PATCH /quotes/:quoteId/items/reorder
Reordena los ítems.

**Body:**
```json
{ "items": [{ "id": "uuid", "order": 1 }, { "id": "uuid", "order": 2 }] }
```

---

## Clients (Protegido)

### POST /clients
### GET /clients
### GET /clients/:id
### PATCH /clients/:id
### DELETE /clients/:id

CRUD estándar. No se puede eliminar un cliente que tenga cotizaciones asociadas.

---

## Templates (Protegido)

### POST /templates
### GET /templates
### GET /templates/:id
### PATCH /templates/:id
### DELETE /templates/:id

CRUD estándar. Las plantillas con `userId: null` son globales (solo lectura para usuarios).

---

## Dashboard (Protegido)

### GET /dashboard/metrics
Retorna métricas del usuario: total de cotizaciones, tasa de conversión, valor total, actividad reciente.

---

## Public (Sin autenticación)

### GET /public/quotes/:publicId
Obtiene la cotización para vista del cliente. Registra evento `QUOTE_OPENED`.

---

### POST /public/quotes/:publicId/accept
El cliente acepta la cotización. Cambia estado a ACCEPTED.

**Response:** 204 No Content

---

### POST /public/quotes/:publicId/reject
El cliente rechaza la cotización. Cambia estado a REJECTED.

**Response:** 204 No Content

---

### POST /public/quotes/:publicId/sign
El cliente firma digitalmente la cotización.

**Body:**
```json
{
  "signerName": "Juan Pérez",
  "signatureImage": "data:image/png;base64,..."
}
```

**Response:** 204 No Content

---

### POST /public/track
Registra un evento de descarga de PDF.

**Body:**
```json
{ "publicId": "uuid-de-la-cotizacion" }
```

**Response:** 204 No Content

---

## Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| 400 | Datos de entrada inválidos |
| 401 | No autenticado o token expirado |
| 403 | Sin permisos sobre el recurso |
| 404 | Recurso no encontrado |
| 409 | Conflicto (ej: email ya registrado) |
| 429 | Rate limit excedido |
