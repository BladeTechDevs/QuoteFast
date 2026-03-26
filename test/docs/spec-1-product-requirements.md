# SPEC 1 — Product Requirements Document (PRD)

## 1. Visión del Producto

**Producto:** QuoteFast — Plataforma SaaS para crear, enviar, rastrear y cerrar cotizaciones profesionales.

**Problema central:** Las empresas (agencias de marketing, desarrollo de software, freelancers) crean cotizaciones manualmente en Excel, Word o PDF. Esto genera:
- Pérdida de tiempo (15-30 min por cotización)
- Sin tracking de apertura o interacción del cliente
- Sin métricas de conversión
- Imagen poco profesional
- Cotizaciones perdidas en emails

**Propuesta de valor:** Crear una cotización profesional en menos de 2 minutos, con tracking en tiempo real y cierre digital.

---

## 2. User Personas

### Persona 1: Freelancer (Ana, 28 años)
- **Rol:** Diseñadora gráfica freelance
- **Dolor:** Pierde 30 min por cotización en Canva/Word. No sabe si el cliente la leyó.
- **Necesidad:** Crear cotizaciones rápidas, profesionales, con seguimiento.
- **Volumen:** 5-15 cotizaciones/mes
- **Presupuesto:** Bajo, busca plan gratuito o económico.

### Persona 2: Director de Agencia (Carlos, 38 años)
- **Rol:** Director de agencia de marketing digital (equipo de 8)
- **Dolor:** Su equipo usa plantillas inconsistentes. No tiene visibilidad de pipeline de cotizaciones.
- **Necesidad:** Plantillas estandarizadas, dashboard de equipo, métricas de conversión.
- **Volumen:** 30-80 cotizaciones/mes
- **Presupuesto:** Medio, dispuesto a pagar por valor claro.

### Persona 3: Fundador de Software House (Diego, 42 años)
- **Rol:** CEO de empresa de desarrollo de software (equipo de 15)
- **Dolor:** Cotizaciones complejas con múltiples fases. Necesita aprobación interna antes de enviar.
- **Necesidad:** Cotizaciones con secciones/fases, flujo de aprobación, integraciones.
- **Volumen:** 15-40 cotizaciones/mes
- **Presupuesto:** Alto, busca solución enterprise-ready.

---

## 3. User Journeys

### Journey 1: Crear y enviar cotización (flujo principal)
```
Login → Dashboard → "Nueva Cotización" → Seleccionar cliente (o crear nuevo)
→ Agregar items/servicios (nombre, descripción, cantidad, precio)
→ Configurar términos (validez, condiciones de pago, notas)
→ Preview → Enviar por email/link compartible
```

### Journey 2: Cliente recibe y acepta cotización
```
Cliente recibe email → Abre link público → Ve cotización profesional
→ Revisa items → Acepta/Rechaza/Solicita cambios
→ (Evento de tracking registrado en cada paso)
```

### Journey 3: Seguimiento y cierre
```
Dashboard → Ver cotizaciones enviadas → Ver status (vista/no vista/aceptada/rechazada)
→ Ver analytics (tiempo de lectura, secciones vistas)
→ Reenviar o crear nueva versión → Cerrar como ganada/perdida
```

---

## 4. Features: MVP vs Futuro

### MVP (Semanas 1-3)
| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Auth (registro/login) | P0 | JWT, email/password |
| CRUD de cotizaciones | P0 | Crear, editar, duplicar, eliminar |
| Items dentro de cotización | P0 | Nombre, descripción, cantidad, precio unitario, subtotal |
| Generación de PDF | P0 | PDF profesional auto-generado |
| Link público compartible | P0 | URL única para que el cliente vea la cotización |
| Tracking de apertura | P0 | Saber cuándo el cliente abrió la cotización |
| Envío por email | P0 | Enviar cotización directamente desde la plataforma |
| Dashboard básico | P0 | Lista de cotizaciones con status |
| Gestión de clientes | P1 | CRUD básico de clientes |
| Plantillas básicas | P1 | 2-3 plantillas de cotización |

### Futuro (Post-MVP)
| Feature | Fase | Descripción |
|---------|------|-------------|
| AI: generación de cotización | v2 | Describir servicio → AI genera items y precios sugeridos |
| AI: follow-up inteligente | v2 | Sugerencias automáticas de cuándo hacer seguimiento |
| Firma digital | v2 | Aceptación con firma electrónica |
| Multi-moneda | v2 | Soporte para USD, EUR, MXN, etc. |
| Equipo/roles | v3 | Múltiples usuarios por cuenta |
| Flujo de aprobación | v3 | Aprobación interna antes de enviar |
| Integraciones | v3 | Stripe, HubSpot, Slack, Zapier |
| Analytics avanzados | v3 | Heatmap de lectura, tiempo por sección |
| White-label | v4 | Dominio personalizado, branding completo |
| API pública | v4 | Para integraciones custom |

---

## 5. Diferenciadores Clave

1. **Tracking en tiempo real:** No solo "enviado/no enviado". Sabes exactamente cuándo abrieron, cuánto tiempo leyeron, qué secciones vieron.
2. **Velocidad:** Cotización completa en < 2 minutos (vs 15-30 min en herramientas tradicionales).
3. **AI-powered (v2):** Generación automática de items basada en descripción del servicio.
4. **Link público profesional:** El cliente no necesita cuenta. Ve una página web profesional, no un PDF adjunto.
5. **Simplicidad radical:** UX tipo Notion. Sin curva de aprendizaje.

---

## 6. Estrategia de Monetización

### Modelo: Freemium + Tiers

| Plan | Precio | Límites |
|------|--------|---------|
| Free | $0/mes | 5 cotizaciones/mes, 1 usuario, branding QuoteFast |
| Pro | $19/mes | Cotizaciones ilimitadas, 1 usuario, sin branding, tracking avanzado |
| Team | $49/mes | Todo Pro + 5 usuarios, plantillas compartidas, dashboard de equipo |
| Business | $99/mes | Todo Team + 15 usuarios, aprobaciones, integraciones, API |

**Estrategia de conversión:**
- Free → Pro: Límite de cotizaciones + branding forzado
- Pro → Team: Necesidad de colaboración
- Upsell natural por crecimiento del negocio del cliente

---

## 7. KPIs Clave

### Producto
- Tiempo promedio de creación de cotización (target: < 2 min)
- Tasa de conversión cotización → aceptada (target: > 35%)
- Cotizaciones creadas por usuario/mes

### Negocio
- MRR (Monthly Recurring Revenue)
- Churn rate (target: < 5% mensual)
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Conversión Free → Paid (target: > 8%)

### Engagement
- DAU/MAU ratio
- Tasa de apertura de cotizaciones por clientes finales
- Tiempo promedio en plataforma

---

## 8. Riesgos y Supuestos

### Riesgos
| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Mercado saturado (PandaDoc, Proposify) | Alto | Diferenciación por simplicidad y precio. Nicho inicial en LATAM. |
| Baja adopción inicial | Alto | Freemium agresivo. Content marketing. Comunidad. |
| Complejidad técnica del tracking | Medio | MVP con tracking básico (apertura). Iterar. |
| Costos de infraestructura | Medio | Arquitectura serverless/cost-efficient. Escalar con revenue. |

### Supuestos
- Las agencias pequeñas y freelancers están dispuestos a pagar por una herramienta de cotizaciones.
- El tracking de apertura es un diferenciador suficiente para la conversión free → paid.
- El mercado LATAM tiene menos competencia que US/EU para este tipo de herramienta.
- La simplicidad (vs features) es más valorada por el segmento target.
