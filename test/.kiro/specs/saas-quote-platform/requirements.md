# Documento de Requisitos: QuoteFast

## Introducción

QuoteFast es una plataforma SaaS para crear, enviar, rastrear y cerrar cotizaciones profesionales. Resuelve el problema de empresas (agencias de marketing, desarrollo de software, freelancers) que crean cotizaciones manualmente en Excel, Word o PDF, generando pérdida de tiempo, falta de tracking de apertura, sin métricas de conversión, imagen poco profesional y cotizaciones perdidas en emails.

El sistema permite a los usuarios gestionar clientes, crear cotizaciones con ítems detallados, generar PDFs profesionales, compartir cotizaciones mediante links públicos únicos, rastrear la interacción del cliente y gestionar el ciclo de vida completo de cada cotización.

## Glosario

- **QuoteFast**: El sistema SaaS descrito en este documento.
- **Usuario**: Persona registrada en QuoteFast (freelancer, director de agencia, fundador de software house).
- **Cliente**: Entidad (persona o empresa) a quien se dirige una cotización.
- **Cotización**: Documento formal con ítems, precios y condiciones enviado a un cliente.
- **Ítem**: Línea individual dentro de una cotización con nombre, descripción, cantidad y precio unitario.
- **PublicId**: Identificador único e inmutable asignado a cada cotización para acceso público sin autenticación.
- **Plan**: Nivel de suscripción del usuario (FREE, PRO, TEAM, BUSINESS).
- **PDF**: Documento en formato Portable Document Format generado a partir de una cotización.
- **Plantilla**: Estructura predefinida reutilizable para crear cotizaciones.
- **TrackingEvent**: Registro de una interacción del cliente con una cotización (apertura, aceptación, rechazo, descarga de PDF).
- **Pipeline**: Valor total de cotizaciones activas (en estado SENT o VIEWED).
- **Worker**: Proceso asíncrono ejecutado en AWS Lambda para tareas como generación de PDF y envío de email.
- **Estado**: Fase del ciclo de vida de una cotización (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED).

---

## Requisitos

### Requisito 1: Autenticación y Gestión de Sesión

**Historia de Usuario:** Como usuario, quiero registrarme e iniciar sesión de forma segura, para que pueda acceder a mis cotizaciones y datos desde cualquier dispositivo.

#### Criterios de Aceptación

1. WHEN un usuario envía email y contraseña válidos en el endpoint de registro, THE QuoteFast SHALL crear una cuenta de usuario con contraseña hasheada y retornar un token JWT de acceso y un refresh token.
2. WHEN un usuario envía credenciales correctas en el endpoint de login, THE QuoteFast SHALL retornar un token JWT de acceso con expiración de 15 minutos y un refresh token con expiración de 7 días.
3. WHEN un usuario envía un refresh token válido y no expirado, THE QuoteFast SHALL emitir un nuevo token JWT de acceso.
4. IF un usuario envía credenciales incorrectas en el login, THEN THE QuoteFast SHALL retornar un error 401 sin revelar si el email existe o no.
5. IF un usuario envía un token JWT expirado o inválido en cualquier endpoint protegido, THEN THE QuoteFast SHALL retornar un error 401.
6. THE QuoteFast SHALL almacenar el hash del refresh token en la base de datos para permitir invalidación.
7. WHEN un usuario se registra con un email ya existente, THE QuoteFast SHALL retornar un error 409 indicando que el email ya está en uso.

---

### Requisito 2: Gestión de Clientes

**Historia de Usuario:** Como usuario, quiero gestionar un directorio de clientes, para que pueda asociar cotizaciones a clientes específicos y reutilizar su información.

#### Criterios de Aceptación

1. THE QuoteFast SHALL permitir al usuario crear, leer, actualizar y eliminar clientes con los campos: nombre, email, empresa, teléfono, dirección y notas.
2. WHEN un usuario crea o actualiza un cliente, THE QuoteFast SHALL validar que el campo nombre no esté vacío.
3. THE QuoteFast SHALL garantizar que cada usuario solo pueda ver y modificar sus propios clientes.
4. IF un usuario intenta eliminar un cliente que tiene cotizaciones asociadas, THEN THE QuoteFast SHALL retornar un error 409 indicando que el cliente tiene cotizaciones activas.
5. WHEN un usuario lista sus clientes, THE QuoteFast SHALL retornar la lista paginada ordenada por fecha de creación descendente.

---

### Requisito 3: Creación y Edición de Cotizaciones

**Historia de Usuario:** Como usuario, quiero crear y editar cotizaciones con ítems detallados, para que pueda presentar propuestas profesionales a mis clientes.

#### Criterios de Aceptación

1. THE QuoteFast SHALL permitir al usuario crear una cotización con los campos: título, clientId, moneda, tasa de impuesto (taxRate), descuento, notas, términos y fecha de validez (validUntil).
2. WHEN se crea una cotización, THE QuoteFast SHALL asignar automáticamente un publicId único e inmutable generado con UUID v4.
3. WHEN se crea una cotización, THE QuoteFast SHALL establecer el estado inicial como DRAFT.
4. THE QuoteFast SHALL permitir agregar, editar y eliminar ítems de una cotización, donde cada ítem tiene: nombre, descripción, cantidad, precio unitario y orden.
5. WHEN un ítem es creado o actualizado, THE QuoteFast SHALL calcular el total del ítem como: `total = cantidad * precioUnitario`.
6. WHEN los ítems de una cotización son modificados, THE QuoteFast SHALL recalcular automáticamente: `subtotal = suma(item.total)`, `taxAmount = subtotal * taxRate / 100`, `total = subtotal + taxAmount - descuento`.
7. WHILE una cotización está en estado ACCEPTED o REJECTED, THE QuoteFast SHALL rechazar cualquier intento de edición retornando un error 422.
8. THE QuoteFast SHALL garantizar que cada usuario solo pueda ver y modificar sus propias cotizaciones.
9. THE QuoteFast SHALL permitir duplicar una cotización existente, creando una copia en estado DRAFT con un nuevo publicId.
10. WHEN un usuario lista sus cotizaciones, THE QuoteFast SHALL retornar la lista paginada con filtros por estado y ordenada por fecha de creación descendente.

---

### Requisito 4: Envío de Cotizaciones

**Historia de Usuario:** Como usuario, quiero enviar cotizaciones por email directamente desde la plataforma, para que mis clientes reciban una presentación profesional con un link de acceso único.

#### Criterios de Aceptación

1. WHEN un usuario solicita enviar una cotización, THE QuoteFast SHALL validar que la cotización tenga al menos 1 ítem antes de procesar el envío.
2. IF un usuario intenta enviar una cotización sin ítems, THEN THE QuoteFast SHALL retornar un error 422 indicando que se requiere al menos un ítem.
3. WHEN una cotización es enviada, THE QuoteFast SHALL encolar un job en SQS para generar el PDF y enviar el email mediante AWS SES.
4. WHEN el Worker procesa el envío, THE QuoteFast SHALL generar un PDF profesional, almacenarlo en S3 y actualizar el campo pdfUrl en la cotización.
5. WHEN el email es enviado exitosamente, THE QuoteFast SHALL actualizar el estado de la cotización a SENT y registrar la fecha en sentAt.
6. WHEN una cotización es enviada, THE QuoteFast SHALL incluir en el email el link público con el publicId de la cotización.
7. IF el Worker falla al generar el PDF o enviar el email, THEN THE QuoteFast SHALL reintentar el job hasta 3 veces con backoff exponencial.

---

### Requisito 5: Vista Pública de Cotización

**Historia de Usuario:** Como cliente, quiero ver la cotización que me enviaron sin necesidad de crear una cuenta, para que pueda revisar los detalles y tomar una decisión de forma sencilla.

#### Criterios de Aceptación

1. WHEN un cliente accede al endpoint público con un publicId válido, THE QuoteFast SHALL retornar los datos completos de la cotización incluyendo ítems, totales, información del emisor y condiciones.
2. IF un cliente accede con un publicId inexistente, THEN THE QuoteFast SHALL retornar un error 404.
3. WHEN un cliente accede a la vista pública, THE QuoteFast SHALL registrar un TrackingEvent de tipo QUOTE_OPENED.
4. WHEN se registra el primer TrackingEvent de tipo QUOTE_OPENED para una cotización, THE QuoteFast SHALL actualizar el campo viewedAt de la cotización con la fecha y hora actual.
5. WHEN se registran TrackingEvents de tipo QUOTE_OPENED subsecuentes para la misma cotización, THE QuoteFast SHALL registrar el evento pero NO actualizar el campo viewedAt.
6. WHEN el estado de la cotización es SENT y se registra el primer acceso, THE QuoteFast SHALL actualizar el estado a VIEWED.
7. THE QuoteFast SHALL registrar en cada TrackingEvent la dirección IP y el User-Agent del cliente.

---

### Requisito 6: Aceptación y Rechazo de Cotizaciones

**Historia de Usuario:** Como cliente, quiero poder aceptar o rechazar una cotización directamente desde el link público, para que el emisor sea notificado inmediatamente de mi decisión.

#### Criterios de Aceptación

1. WHEN un cliente acepta una cotización mediante el endpoint público, THE QuoteFast SHALL actualizar el estado a ACCEPTED y registrar la fecha en acceptedAt.
2. WHEN un cliente rechaza una cotización mediante el endpoint público, THE QuoteFast SHALL actualizar el estado a REJECTED y registrar la fecha en rejectedAt.
3. WHEN una cotización es aceptada o rechazada, THE QuoteFast SHALL registrar un TrackingEvent del tipo correspondiente (QUOTE_ACCEPTED o QUOTE_REJECTED).
4. IF un cliente intenta aceptar o rechazar una cotización que ya está en estado ACCEPTED, REJECTED o EXPIRED, THEN THE QuoteFast SHALL retornar un error 422.
5. WHEN una cotización es aceptada o rechazada, THE QuoteFast SHALL notificar al usuario propietario mediante email.

---

### Requisito 7: Expiración Automática de Cotizaciones

**Historia de Usuario:** Como usuario, quiero que las cotizaciones con fecha de validez vencida se marquen automáticamente como expiradas, para que mi pipeline refleje el estado real de mis oportunidades.

#### Criterios de Aceptación

1. WHEN el campo validUntil de una cotización tiene una fecha anterior a la fecha actual, THE QuoteFast SHALL marcar la cotización como EXPIRED.
2. THE QuoteFast SHALL ejecutar un proceso periódico (al menos una vez por hora) para identificar y marcar cotizaciones expiradas.
3. WHILE una cotización está en estado ACCEPTED o REJECTED, THE QuoteFast SHALL NO marcarla como EXPIRED aunque su validUntil haya pasado.
4. WHEN una cotización es marcada como EXPIRED, THE QuoteFast SHALL registrar un TrackingEvent de tipo QUOTE_EXPIRED.

---

### Requisito 8: Límites del Plan FREE

**Historia de Usuario:** Como usuario en plan FREE, quiero entender claramente los límites de mi plan, para que pueda decidir si necesito actualizar a un plan de pago.

#### Criterios de Aceptación

1. WHILE un usuario está en plan FREE, THE QuoteFast SHALL limitar la creación de cotizaciones a un máximo de 5 cotizaciones por mes calendario.
2. IF un usuario en plan FREE intenta crear una cotización cuando ya tiene 5 o más cotizaciones creadas en el mes actual, THEN THE QuoteFast SHALL retornar un error 403 con un mensaje indicando que se alcanzó el límite del plan.
3. THE QuoteFast SHALL contar hacia el límite mensual todas las cotizaciones creadas en el mes calendario actual, independientemente de su estado.
4. WHILE un usuario está en plan PRO, TEAM o BUSINESS, THE QuoteFast SHALL permitir la creación de cotizaciones sin límite mensual.

---

### Requisito 9: Dashboard y Métricas

**Historia de Usuario:** Como usuario, quiero ver un dashboard con el estado de mis cotizaciones y métricas clave, para que pueda tomar decisiones informadas sobre mi pipeline de ventas.

#### Criterios de Aceptación

1. THE QuoteFast SHALL mostrar en el dashboard el conteo de cotizaciones agrupadas por estado (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED).
2. THE QuoteFast SHALL calcular y mostrar el valor total del pipeline, definido como la suma de los totales de cotizaciones en estado SENT o VIEWED.
3. THE QuoteFast SHALL mostrar la tasa de conversión, definida como el porcentaje de cotizaciones ACCEPTED sobre el total de cotizaciones enviadas (SENT + VIEWED + ACCEPTED + REJECTED + EXPIRED).
4. THE QuoteFast SHALL mostrar la lista de cotizaciones recientes con su estado, cliente, total y fecha de última actualización.

---

### Requisito 10: Gestión de Plantillas

**Historia de Usuario:** Como usuario, quiero crear y reutilizar plantillas de cotización, para que pueda estandarizar mis propuestas y reducir el tiempo de creación.

#### Criterios de Aceptación

1. THE QuoteFast SHALL permitir al usuario crear, leer, actualizar y eliminar plantillas con nombre y contenido.
2. THE QuoteFast SHALL garantizar que cada usuario solo pueda ver y modificar sus propias plantillas.
3. WHERE el plan del usuario es TEAM o BUSINESS, THE QuoteFast SHALL permitir compartir plantillas entre los miembros del equipo.
4. WHEN un usuario crea una cotización desde una plantilla, THE QuoteFast SHALL pre-poblar los campos de la cotización con el contenido de la plantilla.
5. THE QuoteFast SHALL proveer al menos 2 plantillas predeterminadas del sistema disponibles para todos los usuarios.

---

### Requisito 11: Generación de PDF Profesional

**Historia de Usuario:** Como usuario, quiero que las cotizaciones se generen como PDFs con diseño profesional, para que mis clientes reciban documentos de alta calidad que reflejen la imagen de mi empresa.

#### Criterios de Aceptación

1. WHEN el Worker procesa la generación de PDF, THE QuoteFast SHALL producir un PDF que incluya: logo/nombre de la empresa, datos del cliente, tabla de ítems con subtotales, impuestos, descuentos, total final, notas y términos.
2. THE QuoteFast SHALL almacenar el PDF generado en S3 con una URL firmada de acceso.
3. WHEN un cliente descarga el PDF desde la vista pública, THE QuoteFast SHALL registrar un TrackingEvent de tipo QUOTE_PDF_DOWNLOADED.
4. THE QuoteFast SHALL garantizar que el PDF generado sea idéntico en contenido a los datos de la cotización en la base de datos en el momento de la generación.

---

### Requisito 12: Seguridad y Aislamiento de Datos

**Historia de Usuario:** Como usuario, quiero que mis datos estén completamente aislados de otros usuarios, para que la información confidencial de mis cotizaciones y clientes esté protegida.

#### Criterios de Aceptación

1. THE QuoteFast SHALL validar en cada endpoint protegido que el recurso solicitado pertenece al usuario autenticado.
2. IF un usuario autenticado intenta acceder a un recurso de otro usuario, THEN THE QuoteFast SHALL retornar un error 404 (no revelar existencia del recurso).
3. THE QuoteFast SHALL aplicar rate limiting de 100 requests por minuto por usuario en endpoints protegidos.
4. THE QuoteFast SHALL aplicar rate limiting de 30 requests por minuto por IP en endpoints públicos.
5. THE QuoteFast SHALL sanitizar todos los inputs de usuario para prevenir inyección SQL y XSS.
