# QuoteFast — Documentación del Proyecto

QuoteFast es una plataforma SaaS para crear, enviar, rastrear y gestionar cotizaciones profesionales con firma electrónica.

## Índice

- [Arquitectura](./architecture.md)
- [Base de Datos](./database.md)
- [API Reference](./api.md)
- [Frontend](./frontend.md)
- [Configuración y Despliegue](./setup.md)
- [Dependencias Externas](./external-dependencies.md)
- [Testing](./testing.md)

## Resumen del Sistema

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | NestJS 10, TypeScript, Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Cache / Cola | Redis 7 |
| Jobs asíncronos | AWS SQS (configurado, pendiente de implementar) |
| Almacenamiento | AWS S3 (pendiente de implementar) |
| Email | AWS SES (pendiente de implementar) |

## Flujo principal

```
Usuario crea cotización (DRAFT)
  → Envía al cliente (SENT)
  → Cliente abre el link público (VIEWED)
  → Cliente acepta / rechaza / firma (ACCEPTED | REJECTED | SIGNED)
  → Si vence la fecha límite → EXPIRED
```
