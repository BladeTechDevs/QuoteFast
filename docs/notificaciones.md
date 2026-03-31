# Sistema de Notificaciones

QuoteFast incluye un sistema de notificaciones en tiempo real (polling) que mantiene al usuario informado de cada paso del flujo de cotización y del estado de su membresía.

---

## Arquitectura

```
Backend (NestJS)                     Frontend (Next.js)
─────────────────                    ──────────────────
NotificationsService                 useNotifications()  ←── polling 30s
  ↑ inyectado en:                    useUnreadCount()    ←── polling 30s
  • QuotesService                    NotificationBell    ←── Sidebar
  • QuotesSendService                  (campana + badge)
  • PublicQuotesService
  • SignatureService
  • QuotesRemindersService
```

Las notificaciones se persisten en la base de datos (tabla `Notification`) y el frontend las consulta cada 30 segundos via polling REST. No se usa WebSocket ni SSE para mantener la arquitectura simple y compatible con el despliegue en ECS/Fargate.

---

## Modelo de Datos

```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String
  type      NotificationType
  title     String
  message   String
  quoteId   String?          // referencia opcional a la cotización
  metadata  Json?
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())
  user      User             @relation(...)
}
```

---

## Tipos de Notificación

### Flujo de Cotización

| Tipo | Cuándo se genera | Quién lo dispara |
|------|-----------------|-----------------|
| `QUOTE_CREATED` | Al crear una cotización | `QuotesService.create()` |
| `QUOTE_SENT` | Al enviar la cotización al cliente | `QuotesSendService.send()` |
| `QUOTE_VIEWED_BY_CLIENT` | Primera vez que el cliente abre el link | `PublicQuotesService.getQuoteAndTrackOpen()` |
| `QUOTE_ACCEPTED_BY_CLIENT` | El cliente hace clic en "Aceptar" | `PublicQuotesService.accept()` |
| `QUOTE_REJECTED_BY_CLIENT` | El cliente hace clic en "Rechazar" | `PublicQuotesService.reject()` |
| `QUOTE_SIGNED_BY_CLIENT` | El cliente firma electrónicamente | `SignatureService.signQuote()` |
| `QUOTE_EXPIRED` | El cron diario expira la cotización | `QuotesRemindersService.expireOverdueQuotes()` |
| `QUOTE_REMINDER_SENT` | Se envía recordatorio automático (3 días sin abrir) | `QuotesRemindersService.sendFollowUpReminders()` |

### Membresía y Límites de Plan

| Tipo | Cuándo se genera | Condición |
|------|-----------------|-----------|
| `PLAN_LIMIT_WARNING` | Al crear una cotización | Plan FREE con 2 o 1 cotizaciones restantes |
| `PLAN_LIMIT_REACHED` | Al intentar crear una cotización | Plan FREE con 0 cotizaciones restantes |

---

## API REST

Todos los endpoints requieren autenticación JWT (`Authorization: Bearer <token>`).

```
GET    /api/notifications              → últimas 50 notificaciones
GET    /api/notifications?unread=true  → solo no leídas
GET    /api/notifications/unread-count → { count: number }
PATCH  /api/notifications/:id/read     → marcar una como leída (204)
PATCH  /api/notifications/read-all     → marcar todas como leídas (204)
```

**Respuesta de GET /api/notifications:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "type": "QUOTE_ACCEPTED_BY_CLIENT",
    "title": "¡Cotización aceptada!",
    "message": "El cliente aceptó la cotización \"Proyecto Web\". Puedes proceder con el trabajo.",
    "quoteId": "uuid",
    "metadata": null,
    "read": false,
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
]
```

---

## Frontend

### Componentes

**`NotificationBell`** (`src/components/layout/NotificationBell.tsx`)
- Campana con badge rojo que muestra el conteo de no leídas
- Dropdown con las últimas 50 notificaciones
- Clic en una notificación con `quoteId` navega a `/quotes/:quoteId`
- Botón "Marcar todas como leídas"
- Integrado en el `Sidebar` junto al logo de QuoteFast

### Hooks

```ts
// Listar notificaciones (polling 30s)
const { data: notifications } = useNotifications();

// Conteo de no leídas (polling 30s)
const { data } = useUnreadCount(); // { count: number }

// Marcar una como leída
const markRead = useMarkRead();
markRead.mutate(notificationId);

// Marcar todas como leídas
const markAllRead = useMarkAllRead();
markAllRead.mutate();
```

---

## Limpieza Automática

Las notificaciones **leídas** se eliminan automáticamente a los **3 días** de haber sido creadas. El cron job diario (9:00 AM UTC) ejecuta `NotificationsService.deleteOldAll()` junto con los demás jobs del sistema.

Las notificaciones **no leídas** nunca se eliminan automáticamente.

---

## Flujo Completo con Notificaciones

```
Usuario crea cotización
  → 🔔 QUOTE_CREATED: "Cotización creada en borrador"
  → (si plan FREE y quedan 2) 🔔 PLAN_LIMIT_WARNING: "Te quedan 2 cotizaciones"
  → (si plan FREE y queda 1)  🔔 PLAN_LIMIT_WARNING: "Te queda 1 cotización"

Usuario envía cotización
  → 🔔 QUOTE_SENT: "Cotización enviada, generando PDF y email"

Cliente abre el link (primera vez)
  → 🔔 QUOTE_VIEWED_BY_CLIENT: "Tu cotización fue abierta"

Cliente acepta
  → 🔔 QUOTE_ACCEPTED_BY_CLIENT: "¡Cotización aceptada!"

Cliente rechaza
  → 🔔 QUOTE_REJECTED_BY_CLIENT: "Cotización rechazada"

Cliente firma
  → 🔔 QUOTE_SIGNED_BY_CLIENT: "¡Cotización firmada!"

Cron (3 días sin abrir)
  → 🔔 QUOTE_REMINDER_SENT: "Recordatorio enviado al cliente"

Cron (fecha de validez superada)
  → 🔔 QUOTE_EXPIRED: "Cotización expirada"
```
