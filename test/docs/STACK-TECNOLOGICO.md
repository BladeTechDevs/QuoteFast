# 📦 Stack Tecnológico - QuoteFast

## Resumen General

QuoteFast es una aplicación full-stack para gestión de cotizaciones con arquitectura moderna basada en:
- **Backend:** NestJS + PostgreSQL + Prisma
- **Frontend:** Next.js + React + TailwindCSS
- **Infraestructura:** Docker + AWS Services

---

## 🔧 Backend (NestJS API)

### Core Framework
- **Framework:** NestJS 10.x
- **Runtime:** Node.js 20 LTS
- **Lenguaje:** TypeScript 5.3+
- **Puerto:** 3001

### Base de Datos
- **Motor:** PostgreSQL 16 Alpine
- **ORM:** Prisma 5.10
- **Migraciones:** Prisma Migrate
- **Seeding:** Scripts personalizados con ts-node

### Autenticación y Seguridad
- **JWT:** @nestjs/jwt + passport-jwt
- **Estrategia:** Access tokens (15 min) + Refresh tokens (7 días)
- **Hashing:** bcrypt (12 rounds)
- **Seguridad HTTP:** Helmet
- **Rate Limiting:** @nestjs/throttler
- **Validación:** class-validator + class-transformer + Joi

### Servicios Cloud (AWS)
- **Mensajería:** AWS SQS (@aws-sdk/client-sqs)
- **Uso:** Cola de emails y generación de PDFs
- **Almacenamiento:** S3 (planificado para PDFs)

### Funcionalidades Adicionales
- **Documentación API:** Swagger/OpenAPI (@nestjs/swagger)
- **Tareas Programadas:** @nestjs/schedule (cron jobs)
- **Compresión:** compression middleware
- **UUIDs:** uuid 9.x

### Testing
- **Framework:** Jest 29.7
- **Property-Based Testing:** fast-check 3.17
- **Cobertura:** Configurado con ts-jest
- **Archivos:** `*.spec.ts` y `*.pbt.spec.ts`

### Dependencias Clave
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@prisma/client": "^5.10.0",
  "@aws-sdk/client-sqs": "^3.0.0",
  "bcrypt": "^5.1.1",
  "class-validator": "^0.14.1"
}
```

---

## 🎨 Frontend (Next.js)

### Core Framework
- **Framework:** Next.js 14.2 (App Router)
- **Librería UI:** React 18.3
- **Lenguaje:** TypeScript 5.4+
- **Puerto:** 3000

### Estilos
- **Framework CSS:** Tailwind CSS 3.4
- **PostCSS:** Configurado con autoprefixer
- **Utilidades:** clsx, tailwind-merge
- **Colores personalizados:** primary, success, warning, danger

### Gestión de Estado y Datos
- **Server State:** TanStack Query (React Query) 5.40
- **HTTP Client:** Axios 1.7
- **Cookies:** js-cookie 3.0
- **DevTools:** React Query DevTools

### Formularios y Validación
- **Formularios:** React Hook Form 7.52
- **Validación:** Zod 3.23
- **Resolvers:** @hookform/resolvers 3.6

### Testing
- **Framework:** Vitest 4.1
- **Testing Library:** @testing-library/react 16.3
- **Property-Based Testing:** fast-check 4.6
- **Entorno:** jsdom 29.x
- **Plugin:** @vitejs/plugin-react

### Dependencias Clave
```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "@tanstack/react-query": "^5.40.0",
  "react-hook-form": "^7.52.0",
  "zod": "^3.23.0",
  "tailwindcss": "^3.4.0"
}
```

---

## 🐳 Infraestructura y DevOps

### Contenedores Docker

**PostgreSQL (Desarrollo):**
- Imagen: `postgres:16-alpine`
- Puerto: 5432
- Usuario: `quotefast`
- Base de datos: `quotefast`
- Volumen persistente: `postgres_data`
- Healthcheck configurado

**PostgreSQL (Testing):**
- Imagen: `postgres:16-alpine`
- Puerto: 5433
- Base de datos: `quotefast_test`

**Redis:**
- Imagen: `redis:7-alpine`
- Puerto: 6379
- Healthcheck configurado
- Uso: Cache y sesiones (futuro)

### Docker Compose
```bash
# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Dockerfile Backend
- **Build:** Multi-stage (builder + production)
- **Base:** node:20-alpine
- **Optimización:** npm ci, prisma generate
- **Puerto expuesto:** 3000
- **Comando:** node dist/main

---

## ⚙️ Configuración del Entorno Local

### 1. Requisitos Previos

Instalar en tu máquina:
- **Node.js 20+** (LTS recomendado) - [nodejs.org](https://nodejs.org)
- **Docker Desktop** - [docker.com](https://docker.com)
- **npm** (incluido con Node.js) o **pnpm**
- **Git**

### 2. Clonar y Configurar

```bash
# Clonar repositorio
git clone <repo-url>
cd test
```

### 3. Levantar Servicios Docker

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Verificar que estén corriendo
docker-compose ps
```

### 4. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección Variables de Entorno)

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Cargar datos de ejemplo (opcional)
npm run prisma:seed

# Iniciar servidor de desarrollo
npm run start:dev
```

El backend estará disponible en: http://localhost:3001

### 5. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# El archivo .env.local ya existe con:
# NEXT_PUBLIC_API_URL=http://localhost:3001

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en: http://localhost:3000

---

## 🔐 Variables de Entorno

### Backend (.env)

```bash
# Base de Datos
DATABASE_URL="postgresql://quotefast:quotefast_dev@localhost:5432/quotefast"

# JWT - IMPORTANTE: Cambiar en producción (mínimo 32 caracteres)
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-me-refresh-in-production-min-32-chars"

# Aplicación
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# AWS (Opcional para desarrollo, requerido para emails)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SQS_QUEUE_URL=""
```

### Frontend (.env.local)

```bash
# URL del backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🧪 Testing

### Backend
```bash
cd backend

# Tests unitarios
npm test

# Tests en modo watch
npm run test:watch

# Tests con fast-check (property-based)
npm run test:run
```

### Frontend
```bash
cd frontend

# Tests con Vitest
npm test

# Tests en modo watch
npm run test:watch
```

**Nota:** El proyecto usa extensivamente property-based testing con `fast-check` para validar:
- Lógica de firmas electrónicas
- Cálculos de totales y descuentos
- Transiciones de estado de cotizaciones
- Validaciones de datos

---

## 🚀 Scripts Útiles

### Backend
```bash
npm run build              # Compilar para producción
npm run start:prod         # Ejecutar en producción
npm run lint               # Linter ESLint
npm run prisma:studio      # Abrir Prisma Studio (GUI)
npm run prisma:seed-examples  # Cargar datos de ejemplo
```

### Frontend
```bash
npm run build              # Build de producción
npm run start              # Servidor de producción
npm run lint               # Linter Next.js
npm run type-check         # Verificar tipos TypeScript
```

---

## 🌐 Puertos y URLs

| Servicio | Puerto | URL |
|----------|--------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| Swagger Docs | 3001 | http://localhost:3001/api |
| PostgreSQL | 5432 | localhost:5432 |
| PostgreSQL Test | 5433 | localhost:5433 |
| Redis | 6379 | localhost:6379 |
| Prisma Studio | 5555 | http://localhost:5555 |

---

## 📊 Modelo de Datos (Prisma)

### Entidades Principales
- **User:** Usuarios del sistema (autenticación, planes)
- **Client:** Clientes destinatarios de cotizaciones
- **Quote:** Cotizaciones con estados (DRAFT → SENT → VIEWED → SIGNED/ACCEPTED)
- **QuoteItem:** Items/productos dentro de cada cotización
- **Signature:** Firmas electrónicas (base64, metadata de auditoría)
- **TrackingEvent:** Eventos de seguimiento (opens, views, signs)
- **Template:** Plantillas predefinidas

### Enums
- **Plan:** FREE, PRO, TEAM, BUSINESS
- **QuoteStatus:** DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, SIGNED
- **TrackingEventType:** QUOTE_OPENED, QUOTE_VIEWED, QUOTE_ACCEPTED, QUOTE_REJECTED, QUOTE_PDF_DOWNLOADED, QUOTE_EXPIRED, QUOTE_SIGNED

---

## 🔄 Arquitectura de Comunicación

```
┌─────────────┐         HTTP/REST          ┌─────────────┐
│   Next.js   │ ◄────────────────────────► │   NestJS    │
│  Frontend   │    TanStack Query/Axios    │   Backend   │
│  (Port 3000)│                            │  (Port 3001)│
└─────────────┘                            └──────┬──────┘
                                                  │
                                                  │ Prisma ORM
                                                  │
                                           ┌──────▼──────┐
                                           │ PostgreSQL  │
                                           │  (Port 5432)│
                                           └─────────────┘
                                                  │
                                           ┌──────▼──────┐
                                           │    Redis    │
                                           │  (Port 6379)│
                                           └─────────────┘
                                                  │
                                           ┌──────▼──────┐
                                           │   AWS SQS   │
                                           │   (Cloud)   │
                                           └─────────────┘
```

---

## 📝 Notas Importantes

1. **Docker es obligatorio** para desarrollo local (PostgreSQL y Redis)
2. **AWS SQS es opcional** en desarrollo (funcionalidad de emails no funcionará sin configurarlo)
3. **Prisma Studio** es útil para inspeccionar la base de datos visualmente
4. **Property-based testing** requiere fast-check instalado
5. **JWT secrets** deben ser strings aleatorios de mínimo 32 caracteres en producción
6. El proyecto usa **soft deletes** (campo `deletedAt`) para cotizaciones

---

## 🔗 Referencias

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TanStack Query Documentation](https://tanstack.com/query)
- [fast-check Documentation](https://fast-check.dev)
