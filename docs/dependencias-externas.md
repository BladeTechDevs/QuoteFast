# Dependencias Externas (AWS)

En desarrollo, los jobs de email y PDF se simulan (no se envían emails reales ni se generan PDFs reales). Para producción se requieren los siguientes servicios AWS.

## Estado actual

| Funcionalidad | Desarrollo | Producción |
|---------------|-----------|-----------|
| Auth y usuarios | ✅ | ✅ |
| Clientes | ✅ | ✅ |
| Cotizaciones | ✅ | ✅ |
| Firma electrónica | ✅ | ✅ |
| Envío de emails | ⚠️ simulado | Requiere SES + SQS |
| Generación de PDFs | ⚠️ simulado | Requiere S3 + SQS + Lambda |

---

## AWS SQS

**Propósito:** Cola de mensajes para procesamiento asíncrono (emails, PDFs).

**Configuración:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/quotefast-jobs
```

**Permisos IAM requeridos:**
```json
{
  "Action": [
    "sqs:SendMessage",
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"
  ],
  "Resource": "arn:aws:sqs:us-east-1:...:quotefast-jobs"
}
```

---

## AWS S3

**Propósito:** Almacenamiento de PDFs generados.

**Configuración:**
```env
S3_BUCKET=quotefast-pdfs
AWS_REGION=us-east-1
```

**Permisos IAM requeridos:**
```json
{
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::quotefast-pdfs/*"
}
```

Los PDFs se almacenan en: `quotes/{quoteId}/quote-{publicId}.pdf`

---

## AWS SES

**Propósito:** Envío de emails transaccionales (cotizaciones a clientes).

**Configuración:**
```env
SES_FROM_EMAIL=noreply@quotefast.io
AWS_REGION=us-east-1
```

**Pasos para configurar:**
1. Verificar el dominio en SES (DNS TXT + DKIM)
2. Salir del sandbox de SES (solicitar producción en AWS Support)
3. Configurar DMARC y SPF en el DNS del dominio

**Permisos IAM requeridos:**
```json
{
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "*"
}
```

---

## Usuario IAM recomendado

Crear un usuario IAM `quotefast-app` con una política que combine todos los permisos anteriores. Nunca usar credenciales de root.

En producción, preferir **IAM Roles** asignados al Task Definition de ECS en lugar de access keys.
