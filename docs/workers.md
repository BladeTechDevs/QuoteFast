# Workers (AWS Lambda)

Los workers son funciones Lambda que consumen mensajes de AWS SQS para procesar tareas asíncronas.

Ubicación: `workers/src/`

## Email Worker (`email-worker.ts`)

Procesa mensajes de tipo `SEND_QUOTE` o `SEND_EMAIL`.

**Flujo:**
1. Recibe evento SQS con `{ quoteId, type, retryCount }`
2. Consulta la cotización en la base de datos
3. Genera HTML y texto plano del email
4. Envía el email via **AWS SES** con el link público de la cotización
5. Actualiza el estado de la cotización a `SENT`

**Reintentos:**
- Máximo 3 intentos
- Delays: 0s → 30s → 5min
- Si supera los reintentos, lanza error y el mensaje va a la DLQ

**Variables de entorno requeridas:**
```env
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@quotefast.io
APP_BASE_URL=https://app.quotefast.io
DATABASE_URL=...
```

---

## PDF Worker (`pdf-worker.ts`)

Procesa mensajes de tipo `SEND_QUOTE` o `GENERATE_PDF`.

**Flujo:**
1. Recibe evento SQS con `{ quoteId, type, retryCount }`
2. Consulta la cotización con ítems, cliente y usuario
3. Genera el PDF usando **PDFKit**
4. Sube el PDF a **AWS S3** en la ruta `quotes/{quoteId}/quote-{publicId}.pdf`
5. Actualiza `pdfUrl` en la cotización

**Variables de entorno requeridas:**
```env
AWS_REGION=us-east-1
S3_BUCKET=quotefast-pdfs
DATABASE_URL=...
```

---

## Expiry Worker (`expiry-worker.ts`)

Tarea programada (cron) que marca como `EXPIRED` las cotizaciones cuya fecha `validUntil` ya pasó y siguen en estado `SENT` o `VIEWED`.

---

## Formato del Mensaje SQS

```json
{
  "quoteId": "uuid",
  "type": "SEND_QUOTE | SEND_EMAIL | GENERATE_PDF",
  "retryCount": 0
}
```

---

## Scripts

```bash
npm run build   # compila TypeScript a dist/
npm run test    # Jest
```

---

## Despliegue

Los workers se despliegan como funciones Lambda via Terraform (módulo `terraform/modules/lambda`).

- **Dev:** 256 MB de memoria, timeout 30s
- **Prod:** 1 GB de memoria, timeout 60s

Ver [Infraestructura](./infraestructura.md) para más detalles.
