# Recomendaciones — Producto y Roadmap

## 1. Onboarding Guiado 🔴 Crítico

El spec no define qué pasa después del registro. Un usuario nuevo llega al dashboard vacío y no sabe qué hacer. Esto mata la conversión.

**Flujo sugerido:**
```
Registro exitoso
    │
    ▼
Onboarding (3 pasos, saltable)
    │
    ├── Paso 1: "Crea tu primera cotización" (demo interactiva)
    ├── Paso 2: "Agrega un cliente" (opcional)
    └── Paso 3: "Personaliza tu perfil" (nombre de empresa, logo)
    │
    ▼
Dashboard con cotización de ejemplo pre-cargada
```

**Implementación mínima:**
- Campo `onboardingCompleted: Boolean @default(false)` en el modelo `User`
- Redirigir a `/onboarding` si `onboardingCompleted === false`
- Checklist visual en el dashboard hasta completar los pasos

---

## 2. Notificaciones en Tiempo Real 🟡 Importante

Cuando un cliente abre o acepta una cotización, el usuario no se entera hasta que refresca el dashboard. Esto reduce el valor del tracking.

**Opciones por complejidad:**

| Opción | Complejidad | Costo |
|--------|-------------|-------|
| Email notification (SES) | Baja | ~$0 |
| Polling cada 30s (ya en el spec) | Baja | Bajo |
| Server-Sent Events (SSE) | Media | Bajo |
| WebSockets | Alta | Medio |

**Recomendación para MVP:** Email + polling. Cuando el cliente abre la cotización, enviar email al usuario: "Tu cotización 'Propuesta X' fue vista hace 5 minutos."

**Implementación:**
```typescript
// En tracking.service.ts, al registrar QUOTE_OPENED:
if (dto.eventType === 'QUOTE_OPENED' && !quote.viewedAt) {
  // Enviar notificación al dueño de la cotización
  await this.sqsService.sendMessage('email-queue', {
    type: 'QUOTE_VIEWED_NOTIFICATION',
    quoteId: quote.id,
    userId: quote.userId,
    viewedAt: new Date().toISOString(),
  });
}
```

---

## 3. Búsqueda y Filtros Avanzados 🟡 Importante

La lista de cotizaciones solo filtra por status. Con 50+ cotizaciones, encontrar una específica es difícil.

**Filtros a agregar en `ListQuotesDto`:**
```typescript
export class ListQuotesDto {
  // Existentes
  status?: QuoteStatus;
  page?: number;
  limit?: number;

  // Nuevos
  search?: string;        // Buscar en título
  clientId?: string;      // Filtrar por cliente
  dateFrom?: string;      // Rango de fechas
  dateTo?: string;
  minTotal?: number;      // Rango de montos
  maxTotal?: number;
  currency?: string;
}
```

**En el servicio:**
```typescript
where: {
  userId,
  deletedAt: null,
  ...(query.search && {
    title: { contains: query.search, mode: 'insensitive' },
  }),
  ...(query.clientId && { clientId: query.clientId }),
  ...(query.dateFrom && { createdAt: { gte: new Date(query.dateFrom) } }),
}
```

---

## 4. Duplicar Cotización con Nuevo Cliente 🟡 Importante

La función de duplicar existe, pero siempre copia el mismo cliente. Muchas veces el usuario quiere reusar una cotización para un cliente diferente.

**Mejorar el endpoint:**
```typescript
// POST /api/quotes/:id/duplicate
// Request body (opcional):
{
  "clientId": "nuevo-cliente-id",  // Si se omite, copia el cliente original
  "title": "Propuesta para Cliente B"  // Si se omite, agrega "(copy)"
}
```

---

## 5. Vista Previa Antes de Enviar 🟡 Importante

El spec menciona una página de preview (`/quotes/:id/preview`), pero no está claro si está implementada. El usuario debería poder ver exactamente cómo verá el cliente la cotización antes de enviarla.

**Implementar como ruta separada que renderiza el mismo componente que la vista pública:**
```typescript
// /quotes/:id/preview → renderiza PublicQuoteView con los datos de la cotización
// Agregar banner: "Vista previa — Así verá tu cliente esta cotización"
// Botón: "Enviar cotización" → abre el modal de envío
```

---

## 6. Métricas de Conversión en Dashboard 🟡 Importante

El dashboard actual muestra conteos básicos. Para un SaaS de cotizaciones, las métricas de conversión son el diferenciador clave.

**Métricas a agregar:**
```typescript
// dashboard.service.ts
async getMetrics(userId: string) {
  // Existentes: total, draft, sent, accepted

  // Nuevas:
  const conversionRate = (accepted / sent) * 100;  // % de cotizaciones aceptadas
  const avgTimeToAccept = /* promedio de días entre sentAt y acceptedAt */;
  const avgQuoteValue = total / count;
  const openRate = (viewed / sent) * 100;  // % de cotizaciones abiertas

  return {
    // ...existentes
    conversionRate,
    avgTimeToAccept,
    avgQuoteValue,
    openRate,
  };
}
```

---

## 7. Recordatorios Automáticos 🟢 Nice to have

Si una cotización enviada no ha sido vista en 3 días, o no ha sido respondida en 7 días, enviar un recordatorio automático al usuario para hacer follow-up.

**Implementar con un cron job:**
```typescript
// Usando @nestjs/schedule
@Cron('0 9 * * *')  // Todos los días a las 9am
async sendFollowUpReminders() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const unviewedQuotes = await this.prisma.quote.findMany({
    where: {
      status: 'SENT',
      viewedAt: null,
      sentAt: { lte: threeDaysAgo },
    },
    include: { user: true, client: true },
  });

  for (const quote of unviewedQuotes) {
    await this.sqsService.sendMessage('email-queue', {
      type: 'FOLLOW_UP_REMINDER',
      quoteId: quote.id,
      userId: quote.userId,
    });
  }
}
```

---

## 8. Personalización de Marca 🟢 Nice to have

La vista pública muestra "Powered by QuoteFast" en el plan FREE. Para el plan PRO, el usuario debería poder agregar su logo y colores.

**Campos a agregar en `User`:**
```prisma
model User {
  // ...existentes
  logoUrl     String?
  brandColor  String?  @default("#2563EB")
  brandName   String?  // Si es diferente al nombre del usuario
}
```

**En la vista pública:**
- Plan FREE: Logo de QuoteFast + "Powered by QuoteFast"
- Plan PRO+: Logo del usuario + colores de marca + sin branding de QuoteFast

---

## 9. Exportar a PDF desde el Frontend 🟢 Nice to have

Actualmente el PDF se genera en Lambda (proceso asíncrono). Para el usuario, esto significa esperar. Una alternativa es generar el PDF directamente en el navegador para descarga inmediata.

**Opción: `@react-pdf/renderer`**
```bash
npm install @react-pdf/renderer
```

Ventajas: Instantáneo, sin costo de Lambda, el usuario puede personalizar antes de descargar.
Desventajas: El PDF generado en el navegador puede verse diferente al generado en el servidor.

**Recomendación:** Mantener Lambda para el PDF oficial (el que se envía por email), y agregar generación en el navegador como opción de "descarga rápida".

---

## Roadmap Sugerido

### Semana 1-2 (Pre-launch hardening)
- Rate limiting
- Soft delete
- Error boundaries
- RDS backups
- Headers de seguridad
- CORS restrictivo
- Logout endpoint

### Semana 3-4 (v1.0)
- Onboarding guiado
- Notificaciones por email (quote vista/aceptada)
- Búsqueda y filtros en lista de cotizaciones
- Swagger docs
- Docker Compose para dev local
- Tests de integración

### Mes 2 (v1.1)
- Versionamiento de cotizaciones
- Audit logging
- Métricas de conversión en dashboard
- Optimistic updates en frontend
- Recordatorios automáticos
- WAF básico

### Mes 3+ (v2.0)
- AI: generación de items desde descripción
- Firma digital
- Multi-moneda
- Integraciones (Stripe, HubSpot)
- White-label (plan Business)
