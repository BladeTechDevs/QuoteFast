# Guía de Ejecución Local

## Requisitos Previos

- Node.js 20+
- npm 10+
- Docker y Docker Compose
- Git

## 1. Clonar el repositorio

```bash
git clone <repo-url>
cd <repo>
```

## 2. Levantar servicios de infraestructura

```bash
docker-compose up -d
```

Esto levanta:
- PostgreSQL en `localhost:5432`
- PostgreSQL de tests en `localhost:5433`
- Redis en `localhost:6379`

Verificar que estén corriendo:
```bash
docker-compose ps
```

## 3. Configurar el Backend

```bash
cd backend
cp .env.example .env
```

El `.env` por defecto ya está configurado para desarrollo local. No necesitas cambiar nada para empezar.

Instalar dependencias y preparar la base de datos:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

Opcionalmente, cargar cotizaciones de ejemplo en todos los estados:

```bash
npm run prisma:seed-examples
```

Iniciar el servidor de desarrollo:

```bash
npm run start:dev
```

El backend queda disponible en `http://localhost:3001`.
Swagger UI en `http://localhost:3001/api/docs`.

## 4. Configurar el Frontend

```bash
cd frontend
```

Crear el archivo de entorno:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
```

Instalar dependencias e iniciar:

```bash
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:3000`.

## 5. Acceder a la aplicación

- App: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Vista pública de cotización: `http://localhost:3000/q/{publicId}`

Las credenciales del usuario seed están en `backend/prisma/seed.ts`.

## 6. Prisma Studio (opcional)

Para explorar la base de datos visualmente:

```bash
cd backend
npm run prisma:studio
```

Se abre en `http://localhost:5555`.

## Resumen de puertos

| Servicio | Puerto |
|----------|--------|
| Frontend (Next.js) | 3000 |
| Backend (NestJS) | 3001 |
| PostgreSQL (principal) | 5432 |
| PostgreSQL (tests) | 5433 |
| Redis | 6379 |
| Prisma Studio | 5555 |

## Ejecutar Tests

**Backend:**
```bash
cd backend
npm run test:run
```

**Frontend:**
```bash
cd frontend
npm run test
```
