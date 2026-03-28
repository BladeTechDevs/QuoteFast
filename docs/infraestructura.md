# Infraestructura

## Docker (Desarrollo Local)

Archivo: `docker-compose.yml`

```yaml
# Servicios disponibles:
postgres:       PostgreSQL 16  → puerto 5432
postgres-test:  PostgreSQL 16  → puerto 5433 (base de datos de tests)
redis:          Redis 7         → puerto 6379
```

Levantar todos los servicios:
```bash
docker-compose up -d
```

Detener:
```bash
docker-compose down
```

---

## Dockerfile (Backend)

Ubicación: `backend/Dockerfile`

Build multi-etapa:
1. **Stage build** — Node 20-alpine, instala dependencias, compila TypeScript
2. **Stage production** — imagen limpia con solo `dist/` y `node_modules` de producción

Build manual:
```bash
docker build -t quotefast-api ./backend
docker run -p 3001:3001 --env-file backend/.env quotefast-api
```

---

## Terraform (AWS)

Ubicación: `terraform/`

### Módulos

| Módulo | Descripción |
|--------|-------------|
| `networking` | VPC, subnets públicas/privadas, security groups, NAT Gateway |
| `api-gateway` | Amazon API Gateway (HTTP API) como punto de entrada |
| `ecs` | Cluster ECS Fargate para el backend |
| `rds` | PostgreSQL en RDS |
| `s3` | Bucket para PDFs de cotizaciones |
| `ses` | Configuración de AWS SES para emails |
| `sqs` | Cola principal + Dead Letter Queue |
| `lambda` | Funciones Lambda para workers (email + PDF) |
| `secrets-manager` | Secretos de aplicación (DB, JWT x2) |
| `ecr` | Registro de imágenes Docker (compartido) |

### Especificaciones de producción

Todos los servicios se despliegan en la región **us-east-1 (Norte de Virginia)**.

| Servicio | Configuración | Costo mensual est. |
|----------|--------------|-------------------|
| AWS Fargate (ECS) | Linux x86, 1 tarea, 730 h/mes, 20 GB efímero | $9.01 |
| Amazon RDS PostgreSQL | db.t3.micro, 20 GB gp2, Single-AZ, OnDemand | $37.34 |
| NAT Gateway | 1 gateway regional, 1 AZ | $32.89 |
| AWS Secrets Manager | 3 secretos, 1 000 llamadas API/mes | $1.21 |
| Amazon API Gateway | HTTP API, 10 000 req/mes, avg 10 KB | $0.01 |
| Amazon SES | 100 emails/mes | $0.01 |
| S3 Standard | 0.25 GB/mes, 100 PUT + 200 GET | $0.01 |
| AWS SQS | ~200 mensajes/mes (cola estándar) | $0.00 |
| AWS Lambda | 200 invocaciones/mes, 512 MB efímero, x86 | $0.00 |
| Data Transfer | 1 GB saliente/mes | $0.00 |
| **Total estimado** | | **$80.48 / mes** |

> Estimación generada con la [Calculadora de precios de AWS](https://calculator.aws/#/estimate?id=9c5ddfedfac47bb09ca50b74fcba4896bc733e69) — Marzo 2026. No incluye impuestos.

### Secretos en AWS Secrets Manager

Se gestionan 3 secretos de aplicación:

| Secreto | Contenido |
|---------|-----------|
| `quotefast/prod/database-url` | Cadena de conexión PostgreSQL |
| `quotefast/prod/jwt-secret` | Clave JWT para access tokens |
| `quotefast/prod/jwt-refresh-secret` | Clave JWT para refresh tokens |

### Configuración de ECS Fargate

- Sistema operativo: Linux
- Arquitectura CPU: x86
- Tareas: 1 por mes (730 horas continuas)
- Almacenamiento efímero: 20 GB

### Configuración de RDS

- Motor: PostgreSQL
- Instancia: `db.t3.micro`
- Almacenamiento: 20 GB SSD gp2
- Despliegue: Single-AZ
- Modelo de precios: On-Demand (100% utilizado)

### Configuración de Lambda

- Arquitectura: x86
- Modo de invocación: En búfer (triggered por SQS)
- Almacenamiento efímero: 512 MB
- Invocaciones estimadas: 200/mes

### Comandos Terraform

```bash
cd terraform/environments/dev

terraform init
terraform plan
terraform apply
terraform destroy   # ¡cuidado en producción!
```

### Variables requeridas

```hcl
aws_region      = "us-east-1"
environment     = "prod"
```

---

## Arquitectura AWS (Producción)

```
Internet
    │
    ▼
[Amazon API Gateway]
(HTTP API — punto de entrada)
    │
    ▼
[NAT Gateway]
    │
    ▼
[ECS Fargate — 1 tarea]
(NestJS API, subnet privada)
    │
    ├──────────────────────┐
    ▼                      ▼
[RDS PostgreSQL]    [AWS Secrets Manager]
(db.t3.micro,       (DB URL, JWT x2)
 subnet privada)

[SQS Queue]
    │
    ├─────────────┐
    ▼             ▼
[Lambda]      [Lambda]
(email-worker) (pdf-worker)
    │               │
    ▼               ▼
[AWS SES]       [S3 Standard]
(emails)        (PDFs 0.25 GB)
```
