# Variables de Entorno

## Backend (`backend/.env`)

Copiar desde `backend/.env.example` y ajustar los valores.

```env
# ── Base de datos ──────────────────────────────────────────────
DATABASE_URL="postgresql://quotefast:quotefast_dev@localhost:5432/quotefast"

# ── JWT ────────────────────────────────────────────────────────
# Usar strings aleatorios de mínimo 32 caracteres en producción
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-me-refresh-in-production-min-32-chars"

# ── Servidor ───────────────────────────────────────────────────
PORT=3001
NODE_ENV=development          # development | production
FRONTEND_URL="http://localhost:3000"

# ── AWS (requerido para SQS, S3, SES en producción) ───────────
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SQS_QUEUE_URL=""              # URL completa de la cola SQS
S3_BUCKET=""                  # Nombre del bucket S3 para PDFs
SES_FROM_EMAIL="noreply@quotefast.io"
```

### Notas importantes

- `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser strings únicos y largos en producción. Generarlos con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `DATABASE_URL` en producción apunta a la instancia RDS en la subnet privada.
- Las variables `AWS_*` son opcionales en desarrollo (los jobs de email/PDF se simulan).

---

## Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

En producción, Next.js hace proxy de `/api` hacia el backend, por lo que esta variable apunta al dominio del backend (o al ALB interno).

---

## Workers Lambda

Las variables se configuran directamente en la función Lambda (via Terraform o consola AWS):

```env
AWS_REGION=us-east-1
DATABASE_URL=postgresql://...   # RDS en subnet privada
SES_FROM_EMAIL=noreply@quotefast.io
APP_BASE_URL=https://app.quotefast.io
S3_BUCKET=quotefast-pdfs
```
