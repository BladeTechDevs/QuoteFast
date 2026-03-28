# Configuración y Despliegue

## Requisitos Previos

- Node.js 20+
- Docker y Docker Compose
- npm 10+

## Inicio Rápido (Desarrollo)

### 1. Levantar servicios de infraestructura

```bash
cd test
docker-compose up -d
```

Esto inicia:
- PostgreSQL en `localhost:5432` (base de datos principal)
- PostgreSQL en `localhost:5433` (base de datos de tests)
- Redis en `localhost:6379`

### 2. Configurar el Backend

```bash
cd test/backend
cp .env.example .env
npm install
npm run prisma:migrate    # Aplica migraciones
npm run prisma:seed       # Carga datos iniciales
npm run start:dev         # Servidor en modo watch (puerto 3000)
```

### 3. Configurar el Frontend

```bash
cd test/frontend
npm install
npm run dev               # Servidor de desarrollo (puerto 3001)
```

La app estará disponible en `http://localhost:3001`.
La API en `http://localhost:3000/api`.
Swagger en `http://localhost:3000/api/docs`.

---

## Variables de Entorno del Backend

Archivo: `test/backend/.env`

```env
# Base de datos
DATABASE_URL="postgresql://quotefast:quotefast_dev@localhost:5432/quotefast"

# JWT — usar strings aleatorios largos en producción (mín. 32 chars)
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-me-refresh-in-production-min-32-chars"

# Servidor
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:3001"

# AWS (requerido para jobs de email/PDF en producción)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SQS_QUEUE_URL=""
```

## Variables de Entorno del Frontend

Archivo: `test/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## Comandos Útiles del Backend

```bash
npm run prisma:migrate        # Aplica migraciones pendientes
npm run prisma:studio         # Abre Prisma Studio (GUI de BD)
npm run prisma:seed           # Seed básico
npm run prisma:seed-examples  # Seed con datos de ejemplo
npm run test                  # Ejecutar tests
npm run test:run              # Tests en modo CI (sin watch)
npm run build                 # Build de producción
npm run start:prod            # Iniciar en producción
```

---

## Docker Compose

```yaml
# Servicios disponibles:
postgres:       # Puerto 5432 — base de datos principal
postgres-test:  # Puerto 5433 — base de datos para tests
redis:          # Puerto 6379 — cache y cola
```

---

## Migraciones de Base de Datos

Las migraciones están en `test/backend/prisma/migrations/`. Para crear una nueva:

```bash
npm run prisma:migrate -- --name nombre_de_la_migracion
```

---

## Producción

Para producción se requiere adicionalmente:

- Configurar AWS SQS para jobs asíncronos (emails, PDFs)
- Configurar AWS S3 para almacenamiento de PDFs
- Configurar AWS SES para envío de emails
- Usar secrets seguros para JWT (mínimo 32 caracteres aleatorios)
- Configurar CORS con el dominio real del frontend

Ver [Dependencias Externas](./external-dependencies.md) para más detalles.
