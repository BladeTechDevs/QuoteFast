# Dependencias Externas

## Estado Actual

| Funcionalidad | Estado |
|---------------|--------|
| Autenticación y usuarios | ✅ Implementado |
| Gestión de clientes | ✅ Implementado |
| Cotizaciones (CRUD + estados) | ✅ Implementado |
| Firma electrónica | ✅ Implementado |
| Seguimiento de eventos | ✅ Implementado |
| Dashboard y métricas | ✅ Implementado |
| Envío de emails | ⚠️ Simulado (no envía emails reales) |
| Generación de PDFs | ⚠️ Simulado (no genera PDFs reales) |
| Almacenamiento de PDFs | ⚠️ Pendiente de implementar |

---

## AWS SQS — Cola de Mensajes

Propósito: procesamiento asíncrono de tareas (envío de emails, generación de PDFs).

Archivos afectados:
- `backend/src/quotes/sqs.service.ts`
- `backend/src/quotes/quotes-send.service.ts`
- `backend/src/public/public-quotes.service.ts`

Variables de entorno requeridas:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/quotefast-jobs
```

Permisos IAM mínimos:
```json
{
  "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
  "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:quotefast-jobs"
}
```

---

## AWS S3 — Almacenamiento de PDFs

Propósito: almacenar los PDFs generados de las cotizaciones.

Variables de entorno requeridas:
```env
S3_BUCKET=quotefast-pdfs
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

Permisos IAM mínimos:
```json
{
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::quotefast-pdfs/*"
}
```

---

## AWS SES — Envío de Emails

Propósito: enviar cotizaciones por email a los clientes.

Variables de entorno requeridas:
```env
SES_FROM_EMAIL=noreply@tudominio.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

Permisos IAM mínimos:
```json
{
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "*"
}
```

---

## Redis

Propósito: cache y soporte para colas de trabajo.

En desarrollo se levanta automáticamente con Docker Compose en `localhost:6379`.
En producción se recomienda usar ElastiCache o Redis Cloud.
