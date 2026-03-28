# Estimado de Costos AWS — QuoteFast

| Campo | Valor |
|-------|-------|
| Divisa | USD / MXN |
| Creado el | 28/03/2026 |
| Tipo de cambio | $18.12 MXN por USD (28/03/2026) |
| Compartir URL | [Ver estimado](https://calculator.aws/#/estimate?id=9c5ddfedfac47bb09ca50b74fcba4896bc733e69) |

## Resumen de Costos

| Período | USD | MXN |
|---------|-----|-----|
| Mensual | $80.48 | $1,458.30 |
| Inicial | $0.00 | $0.00 |
| 12 meses | $965.76 | $17,499.37 |

> Tipo de cambio utilizado: **$18.12 MXN/USD** al 28 de marzo de 2026.

---

## Desglose por Servicio

Región: **Este de EE.UU. (Norte de Virginia) — us-east-1**

### AWS Fargate

| Propiedad | Valor |
|-----------|-------|
| Sistema operativo | Linux |
| Arquitectura de la CPU | x86 |
| Duración promedio | 730 horas |
| Número de tareas o pods | 1 por mes |
| Almacenamiento efímero (ECS) | 20 GB |

| Período | Costo |
|---------|-------|
| Mensual | $9.01 |
| Inicial | $0.00 |
| 12 meses | $108.12 |

---

### Amazon RDS for PostgreSQL

| Propiedad | Valor |
|-----------|-------|
| Tipo de instancia | db.t3.micro |
| Cantidad de almacenamiento | 20 GB |
| Volumen de almacenamiento | SSD de uso general (gp2) |
| Nodos | 1 |
| Opción de implementación | Single-AZ |
| Utilización | 100% / mes |
| Modelo de precios | OnDemand |

| Período | Costo |
|---------|-------|
| Mensual | $37.34 |
| Inicial | $0.00 |
| 12 meses | $448.08 |

---

### Network Address Translation (NAT) Gateway

| Propiedad | Valor |
|-----------|-------|
| Gateways NAT regionales | 1 |
| Zonas de disponibilidad activas | 1 |
| Gateways NAT | 1 |

| Período | Costo |
|---------|-------|
| Mensual | $32.89 |
| Inicial | $0.00 |
| 12 meses | $394.68 |

---

### AWS Secrets Manager

| Propiedad | Valor |
|-----------|-------|
| Número de secretos | 3 |
| Duración media de cada secreto | 30 días |
| Llamadas a la API | 1 000 por mes |

| Período | Costo |
|---------|-------|
| Mensual | $1.21 |
| Inicial | $0.00 |
| 12 meses | $14.52 |

---

### Amazon API Gateway

| Propiedad | Valor |
|-----------|-------|
| Tipo | HTTP API |
| Solicitudes | 10 000 por mes |
| Tamaño promedio de cada solicitud | 10 KB |
| Caché | Ninguno |

| Período | Costo |
|---------|-------|
| Mensual | $0.01 |
| Inicial | $0.00 |
| 12 meses | $0.12 |

---

### Amazon Simple Email Service (SES)

| Propiedad | Valor |
|-----------|-------|
| Correos procesados | 100 por mes |

| Período | Costo |
|---------|-------|
| Mensual | $0.01 |
| Inicial | $0.00 |
| 12 meses | $0.12 |

---

### S3 Standard

| Propiedad | Valor |
|-----------|-------|
| Almacenamiento | 0.25 GB por mes |
| Solicitudes PUT / COPY / POST / LIST | 100 |
| Solicitudes GET / SELECT | 200 |

| Período | Costo |
|---------|-------|
| Mensual | $0.01 |
| Inicial | $0.00 |
| 12 meses | $0.12 |

---

### AWS Lambda

| Propiedad | Valor |
|-----------|-------|
| Arquitectura | x86 |
| Modo de invocación | En búfer (SQS trigger) |
| Almacenamiento efímero | 512 MB |
| Solicitudes | 200 por mes |

| Período | Costo |
|---------|-------|
| Mensual | $0.00 |
| Inicial | $0.00 |
| 12 meses | $0.00 |

---

### Amazon Simple Queue Service (SQS)

| Propiedad | Valor |
|-----------|-------|
| Solicitudes de cola estándar | 0.0002 millones por mes |

| Período | Costo |
|---------|-------|
| Mensual | $0.00 |
| Inicial | $0.00 |
| 12 meses | $0.00 |

---

### Data Transfer

| Propiedad | Valor |
|-----------|-------|
| Entrada (inbound) | 0 TB por mes |
| Salida (outbound) | 1 GB por mes |

| Período | Costo |
|---------|-------|
| Mensual | $0.00 |
| Inicial | $0.00 |
| 12 meses | $0.00 |

---

## Tabla Consolidada

| Servicio | USD/mes | MXN/mes | USD/año | MXN/año |
|----------|---------|---------|---------|---------|
| Amazon RDS for PostgreSQL | $37.34 | $676.60 | $448.08 | $8,117.21 |
| NAT Gateway | $32.89 | $595.97 | $394.68 | $7,151.60 |
| AWS Fargate | $9.01 | $163.26 | $108.12 | $1,959.13 |
| AWS Secrets Manager | $1.21 | $21.93 | $14.52 | $263.10 |
| Amazon API Gateway | $0.01 | $0.18 | $0.12 | $2.17 |
| Amazon SES | $0.01 | $0.18 | $0.12 | $2.17 |
| S3 Standard | $0.01 | $0.18 | $0.12 | $2.17 |
| AWS Lambda | $0.00 | $0.00 | $0.00 | $0.00 |
| Amazon SQS | $0.00 | $0.00 | $0.00 | $0.00 |
| Data Transfer | $0.00 | $0.00 | $0.00 | $0.00 |
| **Total** | **$80.48** | **$1,458.30** | **$965.76** | **$17,499.37** |

---

> La Calculadora de precios de AWS proporciona únicamente una estimación de las tarifas y no incluye los impuestos que puedan aplicarse. El valor real depende del uso efectivo de AWS.
