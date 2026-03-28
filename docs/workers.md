# Workers (AWS Lambda)

Los workers son funciones Lambda que consumen mensajes de AWS SQS para procesar tareas asíncronas.

Ubicación: `workers/src/`

## Configuración del cliente Prisma

Los workers usan `@prisma/client` pero **no tienen su propio schema**. Apuntan al cliente generado del backend. El `package.json` de workers referencia el cliente del backend directamente:

```json
"@prisma/client": "file:../backend/node_modules/@prisma/client"
```

Por esto, antes de usar los workers hay que tener el cliente generado en el backend:

```bash
# en test/backend
npx prisma generate
```

Luego instalar dependencias de workers:

```bash
# en test/workers
npm install
```

> No correr `prisma generate` dentro de `workers/` — no tiene schema propio.

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

## tsconfig

El `tsconfig.json` usa `"lib": ["ES2020"]` y `"types": ["node", "aws-lambda"]` para que TypeScript reconozca `process`, `Buffer` y los tipos de Lambda sin necesitar `"dom"`.

---

## Despliegue

Los workers se despliegan como funciones Lambda via Terraform (módulo `terraform/modules/lambda`).

- **Memoria:** 512 MB
- **Almacenamiento efímero:** 512 MB
- **Arquitectura:** x86_64
- **Timeout:** 60s
- **Invocaciones estimadas:** ~200/mes

Ver [Infraestructura](./infraestructura.md) para más detalles.
