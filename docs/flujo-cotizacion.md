# Flujo de una Cotización — De la Creación a la Firma

---

## Visión General

```
[Usuario crea]  →  [Edita ítems]  →  [Envía]  →  [Cliente recibe email]
                                                          │
                                              [Cliente abre link público]
                                                          │
                                          ┌───────────────┼───────────────┐
                                          ▼               ▼               ▼
                                       Acepta          Rechaza          Firma
```

---

## Parte 1 — El Usuario (Panel de Administración)

### Paso 1: Crear la cotización

- Ruta: `http://localhost:3000/quotes/new`
- El usuario llena: título, cliente (opcional), moneda, impuesto, descuento, fecha de validez, notas, términos
- Opcionalmente selecciona una **plantilla** para pre-llenar los campos
- La cotización se crea en estado **`DRAFT`**
- En este estado se puede editar libremente

### Paso 2: Agregar ítems

- Desde la página de detalle: `http://localhost:3000/quotes/:id`
- Cada ítem tiene: nombre, descripción, cantidad, precio unitario, descuento por ítem, impuesto por ítem, costo interno
- El campo **`internalCost`** es solo visible para el usuario, nunca se expone al cliente
- Los totales (subtotal, impuesto, total) se recalculan automáticamente al agregar/editar/eliminar ítems

### Paso 3: Enviar la cotización

- El usuario hace clic en **"Enviar cotización"**
- El sistema:
  1. Verifica que la cotización tenga al menos 1 ítem
  2. Cambia el estado a **`SENT`** y registra `sentAt`
  3. Encola un job `SEND_QUOTE` en AWS SQS
  4. Lambda genera el PDF y lo sube a S3
  5. Lambda envía el email al cliente via AWS SES con el link público

> En desarrollo sin AWS configurado, el estado cambia a `SENT` pero no se envía email ni se genera PDF.

---

## Parte 2 — El Cliente (Vista Pública)

### Cómo accede el cliente

El cliente recibe un email con un link de la forma:

```
https://app.quotefast.io/q/{publicId}
```

En local:
```
http://localhost:3000/q/{publicId}
```

El `publicId` es un UUID único por cotización. **No requiere cuenta ni autenticación.**

### Qué ve el cliente

La vista pública muestra:
- Nombre de la empresa emisora y su **branding** (logo, colores personalizados)
- Título de la cotización
- Datos del cliente (nombre, empresa)
- Lista de ítems con cantidad, precio unitario y total (**sin** costo interno)
- Subtotal, impuesto, descuento y **total**
- Notas y términos y condiciones
- Fecha de validez
- Estado actual de la cotización
- Firma electrónica (si ya fue firmada)
- Botón para descargar el PDF (cuando está disponible)

### Qué puede hacer el cliente

| Acción | Resultado |
|--------|-----------|
| Abrir el link | Estado cambia a `VIEWED`, se registra `viewedAt` |
| Hacer clic en "Aceptar" | Estado cambia a `ACCEPTED`, se registra `acceptedAt` |
| Hacer clic en "Rechazar" | Estado cambia a `REJECTED`, se registra `rejectedAt` |
| Firmar electrónicamente | Estado cambia a `ACCEPTED`, se crea registro en `Signature` |
| Descargar PDF | Se registra evento `QUOTE_PDF_DOWNLOADED` |

---

## Parte 3 — Estados y Transiciones

```
DRAFT
  │
  │ Usuario envía
  ▼
SENT ──────────────────────────────────────────► EXPIRED
  │                                              (cron diario si validUntil < hoy)
  │ Cliente abre el link
  ▼
VIEWED ─────────────────────────────────────────► EXPIRED
  │
  ├──► Cliente acepta ──────────────────────────► ACCEPTED (estado final ✅)
  │
  ├──► Cliente rechaza ─────────────────────────► REJECTED (estado final ❌)
  │
  └──► Cliente firma ───────────────────────────► ACCEPTED (estado final ✅✍️)
```

**Estados terminales** (no pueden cambiar): `ACCEPTED`, `REJECTED`, `EXPIRED`

---

## Parte 4 — Tracking de Eventos

Cada interacción del cliente queda registrada en la tabla `TrackingEvent`:

| Evento | Cuándo ocurre |
|--------|--------------|
| `QUOTE_OPENED` | Primera vez que el cliente abre el link |
| `QUOTE_VIEWED` | Cada vez que el cliente ve la cotización |
| `QUOTE_ACCEPTED` | El cliente acepta o firma |
| `QUOTE_REJECTED` | El cliente rechaza |
| `QUOTE_PDF_DOWNLOADED` | El cliente descarga el PDF |
| `QUOTE_EXPIRED` | El cron job marca la cotización como expirada |

Cada evento guarda: IP del cliente, user-agent (navegador/dispositivo) y timestamp.

---

## Parte 5 — Firma Electrónica (detalle)

Si el cliente elige firmar en lugar de solo aceptar:

1. Dibuja su firma en el canvas o escribe su nombre
2. El frontend envía `POST /api/public/quotes/:publicId/sign` con:
   - `signerName`: nombre del firmante (requerido, máx 255 chars)
   - `signatureImage`: imagen base64 (png/jpeg/webp, máx 5 MB)
3. El backend ejecuta una **transacción atómica**:
   - Crea o actualiza el registro en `Signature`
   - Actualiza la cotización: `status = ACCEPTED`, `signedAt = now()`, `acceptedAt = now()`
4. Se registra evento `QUOTE_ACCEPTED` con metadata `{ via: 'signature' }`

---

## Parte 6 — Recordatorios Automáticos

Si el cliente no abre el link en 3 días:
- El cron job diario (9:00 AM UTC) detecta cotizaciones en `SENT` con `viewedAt = null` enviadas hace más de 3 días
- Encola un job `SEND_EMAIL` en SQS para reenviar el recordatorio

---

## Resumen de URLs

| Quién | URL | Descripción |
|-------|-----|-------------|
| Usuario | `/quotes` | Lista de cotizaciones |
| Usuario | `/quotes/new` | Crear cotización |
| Usuario | `/quotes/:id` | Editar / ver detalle |
| Cliente | `/q/:publicId` | Vista pública (sin login) |
