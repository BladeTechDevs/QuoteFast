# Ejemplos de Flujo de Cotizaciones

Este documento explica cómo usar los ejemplos de cotizaciones en diferentes estados del flujo.

## Ejecutar los Ejemplos

Para crear cotizaciones de ejemplo en todos los estados del flujo:

```bash
cd backend
npm run prisma:seed-examples
```

Este comando creará 6 cotizaciones de ejemplo que representan cada estado del flujo:

## Estados del Flujo

### 1. 📝 DRAFT (Borrador)

**Cotización**: Desarrollo de Aplicación Móvil  
**Cliente**: María González - Tech Solutions SA  
**Total**: $268,960 MXN

**Características**:
- Estado inicial de toda cotización
- Puede ser editada libremente
- No ha sido enviada al cliente
- Incluye 4 ítems de servicio

**Acciones disponibles**:
- ✏️ Editar todos los campos
- ➕ Agregar/eliminar ítems
- 📤 Enviar al cliente
- 🗑️ Eliminar

---

### 2. 📤 SENT (Enviada)

**Cotización**: Consultoría de Transformación Digital  
**Cliente**: Carlos Ramírez - Innovación Digital  
**Total**: $20,200 USD  
**Enviada**: Hace 3 días

**Características**:
- Cotización enviada al cliente
- Email enviado con link público
- Cliente aún no ha abierto el link
- Incluye descuento de $5,000 USD

**Acciones disponibles**:
- 👀 Ver detalles
- 📊 Ver tracking (sin eventos aún)
- ⏳ Esperar respuesta del cliente

**Transiciones posibles**:
- → VIEWED (cuando el cliente abre el link)
- → EXPIRED (si pasa la fecha de validez)

---

### 3. 👀 VIEWED (Vista)

**Cotización**: Rediseño de Sitio Web Corporativo  
**Cliente**: Ana Martínez - Startup Ventures  
**Total**: $11,800 USD  
**Enviada**: Hace 5 días  
**Vista**: Hace 2 días

**Características**:
- Cliente abrió el link público
- Se registró la primera visualización
- Cliente descargó el PDF
- 3 eventos de tracking registrados

**Eventos de tracking**:
1. QUOTE_OPENED - Hace 2 días
2. QUOTE_VIEWED - Hace 2 días
3. QUOTE_PDF_DOWNLOADED - Hace 1 día

**Acciones disponibles**:
- 👀 Ver detalles
- 📊 Ver historial de tracking
- ⏳ Esperar decisión del cliente

**Transiciones posibles**:
- → ACCEPTED (si el cliente acepta)
- → REJECTED (si el cliente rechaza)
- → SIGNED (si el cliente firma)
- → EXPIRED (si pasa la fecha de validez)

---

### 4. ✅ ACCEPTED (Aceptada)

**Cotización**: Sistema de Gestión de Inventario  
**Cliente**: María González - Tech Solutions SA  
**Total**: $254,464 MXN  
**Aceptada**: Hace 1 día

**Características**:
- Cliente aceptó la cotización
- Proyecto confirmado
- Estado terminal (no puede cambiar)
- Incluye descuento de $10,000 MXN
- 6 ítems de servicio

**Eventos de tracking**:
1. QUOTE_OPENED - Hace 8 días
2. QUOTE_VIEWED - Hace 8 días
3. QUOTE_ACCEPTED - Hace 1 día

**Acciones disponibles**:
- 👀 Ver detalles (solo lectura)
- 📊 Ver historial completo
- 📄 Descargar PDF
- 🔄 Duplicar para nueva cotización

**Estado final**: ✅ Proyecto confirmado

---

### 5. ❌ REJECTED (Rechazada)

**Cotización**: Desarrollo de E-commerce  
**Cliente**: Carlos Ramírez - Innovación Digital  
**Total**: $8,850 USD  
**Rechazada**: Hace 15 días

**Características**:
- Cliente rechazó la cotización
- Estado terminal (no puede cambiar)
- Cotización expiró hace 5 días
- Útil para análisis de por qué se perdió

**Eventos de tracking**:
1. QUOTE_OPENED - Hace 18 días
2. QUOTE_REJECTED - Hace 15 días

**Acciones disponibles**:
- 👀 Ver detalles (solo lectura)
- 📊 Ver historial
- 🔄 Duplicar para reenviar con cambios

**Estado final**: ❌ Proyecto no confirmado

---

### 6. ✍️ SIGNED (Firmada)

**Cotización**: Desarrollo de Dashboard Analítico  
**Cliente**: Ana Martínez - Startup Ventures  
**Total**: $14,900 USD  
**Firmada**: Hace 2 horas

**Características**:
- Cliente firmó electrónicamente
- Incluye firma digital con timestamp
- Estado terminal (no puede cambiar)
- Máximo nivel de compromiso
- Incluye descuento de $2,000 USD

**Datos de la firma**:
- Firmante: Ana Martínez
- IP: 192.168.1.104
- Dispositivo: iPad
- Timestamp: Hace 2 horas

**Eventos de tracking**:
1. QUOTE_OPENED - Hace 6 días
2. QUOTE_VIEWED - Hace 6 días
3. QUOTE_SIGNED - Hace 2 horas

**Acciones disponibles**:
- 👀 Ver detalles (solo lectura)
- 📊 Ver historial completo
- ✍️ Ver firma electrónica
- 📄 Descargar PDF con firma
- 🔄 Duplicar para nuevo proyecto

**Estado final**: ✅ Proyecto confirmado con firma legal

---

## Diagrama de Flujo

```
┌─────────┐
│  DRAFT  │ ← Estado inicial
└────┬────┘
     │ Enviar
     ↓
┌─────────┐
│  SENT   │ ← Email enviado
└────┬────┘
     │ Cliente abre link
     ↓
┌─────────┐
│ VIEWED  │ ← Cliente vio la cotización
└────┬────┘
     │
     ├─→ Aceptar → ┌──────────┐
     │             │ ACCEPTED │ (Estado final ✅)
     │             └──────────┘
     │
     ├─→ Rechazar → ┌──────────┐
     │              │ REJECTED │ (Estado final ❌)
     │              └──────────┘
     │
     ├─→ Firmar → ┌─────────┐
     │            │ SIGNED  │ (Estado final ✅✍️)
     │            └─────────┘
     │
     └─→ Expirar → ┌─────────┐
                   │ EXPIRED │ (Estado final ⏰)
                   └─────────┘
```

## Probar el Flujo Completo

### 1. Ver cotizaciones en el dashboard

```
http://localhost:3000/quotes
```

Verás las 6 cotizaciones de ejemplo con diferentes estados.

### 2. Ver una cotización en borrador

```
http://localhost:3000/quotes/{id-de-draft}
```

- Edita los campos
- Agrega/elimina ítems
- Haz clic en "Enviar cotización"
- El estado cambiará a SENT

### 3. Ver una cotización pública (como cliente)

Cada cotización tiene un `publicId` único. Para ver la cotización como cliente:

```
http://localhost:3000/q/{publicId}
```

Desde esta vista pública, el cliente puede:
- Ver todos los detalles de la cotización
- Descargar PDF (cuando esté implementado)
- Aceptar la cotización
- Rechazar la cotización
- Firmar electrónicamente

### 4. Tracking de eventos

Cada interacción del cliente se registra:

- **QUOTE_OPENED**: Primera vez que abre el link
- **QUOTE_VIEWED**: Cada vez que ve la cotización
- **QUOTE_PDF_DOWNLOADED**: Cuando descarga el PDF
- **QUOTE_ACCEPTED**: Cuando acepta
- **QUOTE_REJECTED**: Cuando rechaza
- **QUOTE_SIGNED**: Cuando firma

Estos eventos se pueden ver en el dashboard del usuario.

---

## Obtener el publicId de una cotización

Para obtener el link público de una cotización:

```bash
# Conectarse a la base de datos
cd backend
npm run prisma:studio

# O usar SQL directo
psql -d quotefast -c "SELECT id, title, status, publicId FROM \"Quote\";"
```

El link público será:
```
http://localhost:3000/q/{publicId}
```

---

## Limpiar ejemplos

Si quieres eliminar los ejemplos y empezar de nuevo:

```bash
cd backend

# Opción 1: Resetear toda la base de datos
npm run prisma:migrate reset

# Opción 2: Eliminar solo las cotizaciones de ejemplo
# (Ejecutar en Prisma Studio o SQL)
DELETE FROM "Quote" WHERE title IN (
  'Desarrollo de Aplicación Móvil',
  'Consultoría de Transformación Digital',
  'Rediseño de Sitio Web Corporativo',
  'Sistema de Gestión de Inventario',
  'Desarrollo de E-commerce',
  'Desarrollo de Dashboard Analítico'
);
```

---

## Casos de Uso Reales

### Caso 1: Freelancer enviando cotización

1. Crea cotización en DRAFT
2. Agrega ítems y detalles
3. Envía al cliente (→ SENT)
4. Cliente abre el link (→ VIEWED)
5. Cliente acepta (→ ACCEPTED)
6. Comienza el proyecto ✅

### Caso 2: Agencia con firma electrónica

1. Crea cotización en DRAFT
2. Envía al cliente (→ SENT)
3. Cliente revisa (→ VIEWED)
4. Cliente firma digitalmente (→ SIGNED)
5. Contrato legalmente vinculante ✅

### Caso 3: Cotización rechazada

1. Crea cotización en DRAFT
2. Envía al cliente (→ SENT)
3. Cliente revisa (→ VIEWED)
4. Cliente rechaza (→ REJECTED)
5. Analiza por qué se perdió
6. Duplica y ajusta para reenviar

---

## Métricas y Análisis

Con estos ejemplos puedes analizar:

- **Tasa de conversión**: SENT → ACCEPTED
- **Tiempo de respuesta**: Tiempo entre SENT y ACCEPTED/REJECTED
- **Engagement**: Número de veces que el cliente ve la cotización
- **Valor promedio**: Total de cotizaciones aceptadas
- **Tasa de rechazo**: Porcentaje de cotizaciones rechazadas

---

## Próximos Pasos

1. ✅ Flujo de estados implementado
2. ✅ Tracking de eventos implementado
3. ✅ Firma electrónica implementada
4. ⏳ Generación de PDFs (pendiente)
5. ⏳ Envío de emails (pendiente)
6. ⏳ Notificaciones en tiempo real (pendiente)
7. ⏳ Dashboard de métricas (pendiente)
