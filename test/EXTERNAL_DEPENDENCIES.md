# Dependencias Externas

Este documento describe las dependencias externas necesarias para el funcionamiento completo de QuoteFast en producción.

## Estado Actual (Desarrollo)

Actualmente, el sistema funciona en modo de desarrollo con las siguientes limitaciones:

- ✅ Autenticación y gestión de usuarios
- ✅ Gestión de clientes
- ✅ Creación y edición de cotizaciones
- ✅ Cambio de estados de cotizaciones (DRAFT → SENT → VIEWED → ACCEPTED/REJECTED)
- ✅ Firma electrónica de cotizaciones
- ⚠️ Envío de emails (simulado - no se envían emails reales)
- ⚠️ Generación de PDFs (simulado - no se generan PDFs reales)

## Dependencias Requeridas para Producción

### 1. AWS SQS (Simple Queue Service)

**Propósito**: Cola de mensajes para procesamiento asíncrono de tareas (envío de emails, generación de PDFs).

**Configuración requerida**:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/quotefast-jobs
```

**Pasos para configurar**:

1. Crear una cuenta de AWS
2. Crear una cola SQS en la región deseada
3. Crear un usuario IAM con permisos para SQS:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "sqs:SendMessage",
           "sqs:ReceiveMessage",
           "sqs:DeleteMessage",
           "sqs:GetQueueAttributes"
         ],
         "Resource": "arn:aws:sqs:us-east-1:123456789012:quotefast-jobs"
       }
     ]
   }
   ```
4. Obtener las credenciales (Access Key ID y Secret Access Key)
5. Configurar las variables de entorno en el backend

**Archivos afectados**:
- `backend/src/quotes/sqs.service.ts`
- `backend/src/quotes/quotes-send.service.ts`
- `backend/src/public/public-quotes.service.ts`

---

### 2. AWS S3 (Simple Storage Service)

**Propósito**: Almacenamiento de PDFs generados de las cotizaciones.

**Configuración requerida**:

```env
S3_BUCKET=quotefast-pdfs
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

**Pasos para configurar**:

1. Crear un bucket S3 en AWS
2. Configurar permisos del bucket (privado con acceso controlado)
3. Agregar permisos al usuario IAM:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::quotefast-pdfs/*"
       }
     ]
   }
   ```
4. Configurar CORS si es necesario para acceso desde el frontend

**Funcionalidad pendiente de implementar**:
- Servicio de generación de PDFs
- Worker que procese mensajes de SQS para generar PDFs
- Subida de PDFs a S3
- Generación de URLs firmadas para descarga

---

### 3. AWS SES (Simple Email Service)

**Propósito**: Envío de emails transaccionales (cotizaciones enviadas, notificaciones, etc.).

**Configuración requerida**:

```env
SES_FROM_EMAIL=noreply@quotefast.io
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

**Pasos para configurar**:

1. Verificar el dominio en AWS SES
2. Configurar registros DNS (SPF, DKIM, DMARC)
3. Salir del sandbox de SES (solicitar aumento de límites)
4. Agregar permisos al usuario IAM:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

**Funcionalidad pendiente de implementar**:
- Servicio de envío de emails
- Worker que procese mensajes de SQS para enviar emails
- Templates de emails (cotización enviada, aceptada, rechazada, etc.)

---

## Alternativas para Desarrollo Local

### Opción 1: LocalStack (Recomendado)

LocalStack simula servicios de AWS localmente:

```bash
# Instalar LocalStack
pip install localstack

# Iniciar LocalStack con los servicios necesarios
localstack start -d

# Configurar variables de entorno para LocalStack
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

### Opción 2: Servicios Alternativos

- **SQS**: RabbitMQ, Redis Queue, BullMQ
- **S3**: MinIO (compatible con S3 API)
- **SES**: Mailgun, SendGrid, Resend

---

## Workers Pendientes de Implementar

Para procesar los mensajes de SQS, se necesitan workers que:

1. **Email Worker**:
   - Escucha mensajes de tipo `SEND_EMAIL`
   - Genera el contenido del email según el tipo de evento
   - Envía el email usando AWS SES
   - Maneja reintentos en caso de fallo

2. **PDF Worker**:
   - Escucha mensajes de tipo `GENERATE_PDF`
   - Genera el PDF de la cotización usando una librería como Puppeteer o PDFKit
   - Sube el PDF a S3
   - Actualiza el campo `pdfUrl` en la base de datos

3. **Quote Send Worker**:
   - Escucha mensajes de tipo `SEND_QUOTE`
   - Genera el PDF de la cotización
   - Envía el email al cliente con el link de la cotización
   - Actualiza el estado de la cotización

---

## Implementación Sugerida

### Fase 1: Configuración Básica de AWS
- [ ] Crear cuenta de AWS
- [ ] Configurar usuario IAM con permisos necesarios
- [ ] Crear cola SQS
- [ ] Crear bucket S3
- [ ] Verificar dominio en SES

### Fase 2: Implementación de Workers
- [ ] Crear proyecto separado para workers (puede ser en el mismo repo)
- [ ] Implementar Email Worker
- [ ] Implementar PDF Worker
- [ ] Implementar Quote Send Worker
- [ ] Configurar manejo de errores y reintentos

### Fase 3: Templates y Contenido
- [ ] Diseñar templates de emails
- [ ] Diseñar template de PDF para cotizaciones
- [ ] Implementar generación de contenido dinámico

### Fase 4: Testing y Monitoreo
- [ ] Probar flujo completo de envío de cotizaciones
- [ ] Configurar logs y monitoreo (CloudWatch)
- [ ] Configurar alertas para fallos
- [ ] Implementar dead letter queue para mensajes fallidos

---

## Costos Estimados (AWS)

**Uso mensual estimado para 1000 cotizaciones/mes**:

- **SQS**: ~$0.40 (1M requests = $0.40)
- **S3**: ~$0.50 (10GB storage + transferencia)
- **SES**: ~$1.00 (10,000 emails = $1.00)
- **Total**: ~$2-5 USD/mes

**Nota**: Los costos pueden variar según el uso real y la región de AWS.

---

## Estado de Implementación

### ✅ Completado
- Estructura base de SQS service
- Integración de SQS en flujo de envío de cotizaciones
- Manejo de ausencia de credenciales en desarrollo
- Cambio de estados de cotizaciones

### ⚠️ Pendiente
- Workers para procesar mensajes de SQS
- Generación de PDFs
- Envío de emails
- Almacenamiento en S3
- Templates de emails y PDFs

---

## Contacto y Soporte

Para configurar estos servicios en producción, se recomienda:

1. Revisar la documentación oficial de AWS
2. Considerar usar AWS CDK o Terraform para infraestructura como código
3. Implementar CI/CD para despliegue automático de workers
4. Configurar monitoreo y alertas desde el inicio
