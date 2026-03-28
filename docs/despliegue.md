# Guía de Despliegue

## Requisitos

- AWS CLI configurado con permisos suficientes
- Terraform >= 1.5.0
- Docker
- Acceso al repositorio ECR

---

## 1. Preparar infraestructura con Terraform

```bash
cd terraform/environments/dev   # o prod

terraform init
terraform plan -var="certificate_arn=arn:aws:acm:..."
terraform apply -var="certificate_arn=arn:aws:acm:..."
```

Esto crea:
- VPC, subnets, security groups
- RDS PostgreSQL
- ECS Cluster + Task Definition
- ALB con HTTPS
- SQS Queue + DLQ
- S3 Bucket para PDFs
- Lambda functions para workers
- ECR Registry

Guardar los outputs de Terraform (URLs, ARNs) para los pasos siguientes.

---

## 2. Construir y publicar imagen Docker del Backend

```bash
# Autenticarse en ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t quotefast-api ./backend

# Tag
docker tag quotefast-api:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/quotefast-api:latest

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/quotefast-api:latest
```

---

## 3. Ejecutar migraciones en producción

Conectarse a la instancia ECS o usar un task de migración:

```bash
# Via ECS task (recomendado)
aws ecs run-task \
  --cluster quotefast-prod \
  --task-definition quotefast-migrate \
  --launch-type FARGATE \
  --network-configuration "..."
```

O directamente si tienes acceso a la DB:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

---

## 4. Desplegar el Frontend

El frontend de Next.js se puede desplegar en:

**Opción A — Vercel (recomendado para Next.js):**
```bash
npm install -g vercel
cd frontend
vercel --prod
```

Variables de entorno a configurar en Vercel:
```
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

**Opción B — S3 + CloudFront (export estático):**
```bash
cd frontend
npm run build
# Subir la carpeta out/ a S3 y configurar CloudFront
```

**Opción C — ECS Fargate (mismo cluster):**
Agregar un servicio ECS adicional para el frontend con su propio Dockerfile.

---

## 5. Desplegar Workers Lambda

Los workers se despliegan automáticamente via Terraform. Para actualizar el código:

```bash
cd workers
npm run build

# Empaquetar
zip -r email-worker.zip dist/email-worker.js node_modules/

# Actualizar Lambda
aws lambda update-function-code \
  --function-name quotefast-email-worker \
  --zip-file fileb://email-worker.zip
```

---

## 6. Configurar Variables de Entorno en ECS

Las variables de entorno del backend se configuran en el Task Definition de ECS. Usar AWS Secrets Manager para los valores sensibles:

```bash
# Crear secreto
aws secretsmanager create-secret \
  --name quotefast/prod/jwt-secret \
  --secret-string "tu-jwt-secret-aqui"
```

Referenciar en el Task Definition:
```json
{
  "secrets": [
    {
      "name": "JWT_SECRET",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:...:secret:quotefast/prod/jwt-secret"
    }
  ]
}
```

---

## 7. Verificar el despliegue

```bash
# Health check del backend
curl https://api.tudominio.com/api/health

# Verificar Swagger (solo en dev)
open https://api.tudominio.com/api/docs
```

---

## Rollback

Para hacer rollback a una versión anterior:

```bash
# Actualizar la imagen en ECS a un tag anterior
aws ecs update-service \
  --cluster quotefast-prod \
  --service quotefast-api \
  --task-definition quotefast-api:<version-anterior>
```

Para rollback de migraciones, usar:
```bash
npx prisma migrate resolve --rolled-back <migration-name>
```
