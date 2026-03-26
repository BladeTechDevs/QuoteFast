# SPEC 6 — Critical Review & Improvements

## Revisión Crítica de las 5 Specs

---

## 1. Spec 1 (PRD) — Hallazgos

### Fallas identificadas
- **Multi-tenancy no definido:** El PRD no especifica si es single-tenant o multi-tenant. Para SaaS, multi-tenant es esencial desde el diseño.
- **Internacionalización (i18n):** Se menciona LATAM como mercado pero no hay plan de i18n para la plataforma.
- **Onboarding:** No hay flujo de onboarding definido. La primera experiencia del usuario es crítica para conversión free → paid.

### Mejoras sugeridas
- Agregar flujo de onboarding guiado (crear primera cotización en el registro)
- Definir estrategia de i18n desde MVP (al menos ES + EN)
- Agregar persona de "usuario que recibe la cotización" (el cliente final) — su experiencia es clave

---

## 2. Spec 2 (Architecture) — Hallazgos

### Fallas identificadas
- **NAT Gateway es caro para MVP:** $32/mes solo por NAT. Para MVP, una NAT Instance o VPC endpoints son más cost-efficient.
- **No hay rate limiting definido:** Los endpoints públicos (tracking, vista de cotización) necesitan rate limiting para evitar abuso.
- **No hay estrategia de cache:** Las cotizaciones públicas se leen mucho más de lo que se escriben. Redis/CloudFront cache es necesario.

### Problemas de escalabilidad
- **Tracking directo a PostgreSQL:** Con muchos usuarios, los INSERTs de tracking van a saturar la DB. Debería ir a SQS → batch insert desde el inicio.
- **PDF generation con Puppeteer en Lambda:** Puppeteer + Chromium en Lambda es pesado (~50MB). Considerar alternativas como @react-pdf/renderer o gotenberg.

### Mejoras sugeridas
- Implementar rate limiting con un middleware (express-rate-limit o API Gateway throttling)
- Usar Redis desde MVP para cache de cotizaciones públicas (ElastiCache Serverless para bajo costo)
- Tracking siempre vía SQS, nunca directo a DB
- Evaluar gotenberg como alternativa a Puppeteer para PDF (más ligero, Docker-based)

---

## 3. Spec 3 (Backend) — Hallazgos

### Fallas identificadas
- **No hay soft delete:** Las cotizaciones eliminadas se pierden permanentemente. Agregar `deletedAt` para soft delete.
- **No hay versionamiento de cotizaciones:** Cuando se edita una cotización enviada, debería crear una nueva versión, no sobrescribir.
- **Cálculos de totales en el servicio:** Los totales deberían recalcularse con un Prisma middleware o un método dedicado, no depender del frontend.
- **No hay rate limiting en endpoints públicos:** El endpoint de tracking puede ser abusado.

### Problemas de escalabilidad
- **N+1 queries potenciales:** Las relaciones Quote → Items → Client necesitan `include` explícito o DataLoader.
- **Tracking analytics en tiempo real:** `getQuoteAnalytics()` hace un full scan de eventos. Con volumen, necesita agregaciones pre-calculadas.

### Mejoras sugeridas
```prisma
// Agregar a Quote model:
  version     Int       @default(1)
  parentId    String?   // referencia a versión anterior
  deletedAt   DateTime?

// Agregar modelo de auditoría:
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // QUOTE_CREATED, QUOTE_SENT, etc.
  entity    String   // quote, client, etc.
  entityId  String
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entityId])
  @@map("audit_logs")
}
```

- Agregar Prisma middleware para recalcular totales automáticamente
- Implementar cursor-based pagination en vez de offset
- Pre-calcular analytics de tracking con un cron job o al momento del evento

---

## 4. Spec 4 (Frontend) — Hallazgos

### Fallas identificadas
- **No hay manejo de errores definido:** ¿Qué pasa si falla el auto-save? ¿Si falla el envío? Necesita error boundaries y retry logic.
- **No hay estado offline:** Si el usuario pierde conexión mientras edita, pierde cambios. Considerar optimistic updates + queue.
- **Accesibilidad no mencionada:** Keyboard navigation está, pero falta ARIA labels, screen reader support, contrast ratios.

### Problemas de UX
- **Formulario de cotización puede ser largo:** Con muchos items, el scroll se vuelve incómodo. Considerar secciones colapsables.
- **No hay búsqueda global:** El usuario debería poder buscar cotizaciones por título, cliente, monto.

### Mejoras sugeridas
- Agregar error boundary global con fallback UI
- Implementar optimistic updates en TanStack Query para UX instantánea
- Agregar búsqueda global con debounce (Cmd+K pattern)
- Definir skeleton loaders para cada pantalla
- Agregar ARIA labels y roles a todos los componentes interactivos

---

## 5. Spec 5 (Infrastructure) — Hallazgos

### Fallas identificadas
- **No hay backup strategy para RDS:** Necesita automated backups + point-in-time recovery.
- **No hay WAF:** Los endpoints públicos necesitan protección contra bots y ataques.
- **Secrets rotation no definida:** Los secrets en Secrets Manager deberían rotarse automáticamente.

### Problemas de escalabilidad
- **Single region:** No hay plan de multi-region. Para LATAM, considerar us-east-1 + sa-east-1.
- **No hay blue/green deployment:** El deploy actual causa downtime breve. ECS soporta blue/green con CodeDeploy.

### Mejoras sugeridas
- Habilitar RDS automated backups (7 días retención para dev, 30 para prod)
- Agregar WAF en ALB con reglas básicas (rate limiting, SQL injection, XSS)
- Implementar blue/green deployment con CodeDeploy para zero-downtime
- Agregar VPC Flow Logs para auditoría de red
- Considerar AWS Backup para estrategia centralizada

---

## Resumen de Prioridades

### Crítico (hacer antes de MVP)
1. Rate limiting en endpoints públicos
2. Soft delete en cotizaciones
3. Tracking vía SQS (no directo a DB)
4. RDS backups automatizados
5. Error handling en frontend

### Importante (hacer en v1.1)
1. Versionamiento de cotizaciones
2. Redis cache para cotizaciones públicas
3. Búsqueda global
4. WAF básico
5. Blue/green deployment

### Nice to have (v2+)
1. Multi-region
2. Audit log completo
3. Analytics pre-calculados
4. Offline support en frontend
