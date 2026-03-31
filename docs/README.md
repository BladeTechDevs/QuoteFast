# QuoteFast — Documentación del Proyecto

QuoteFast es una plataforma SaaS para crear, enviar y rastrear cotizaciones profesionales.

## Índice

- [Arquitectura General](./arquitectura.md)
- [Base de Datos](./base-de-datos.md)
- [API Backend](./api-backend.md)
- [Frontend](./frontend.md)
- [Workers (Lambda)](./workers.md)
- [Infraestructura (Docker & Terraform)](./infraestructura.md)
- [Variables de Entorno](./variables-de-entorno.md)
- [Guía de Ejecución Local](./ejecucion-local.md)
- [Guía de Despliegue](./despliegue.md)
- [CI/CD](./cicd.md)
- [Dependencias Externas (AWS)](./dependencias-externas.md)
- [Referencia de Funciones](./funciones.md)
- [Flujo de una Cotización](./flujo-cotizacion.md)
- [Sistema de Notificaciones](./notificaciones.md)
- [Documento Formal de Requerimientos (DFR)](./DFR-QuoteFast.md)

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS 10, TypeScript |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Cola de mensajes | AWS SQS |
| Almacenamiento | AWS S3 |
| Email | AWS SES |
| Workers | AWS Lambda (TypeScript) |
| Infraestructura | Terraform + AWS ECS/Fargate |
| CI/CD | GitHub Actions |
| Contenedores | Docker + Docker Compose |
