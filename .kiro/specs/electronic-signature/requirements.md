# Requirements Document

## Introduction

Este documento define los requisitos para la funcionalidad de firma electrónica en QuoteFast. La firma electrónica permitirá a los clientes firmar cotizaciones digitalmente desde la vista pública, formalizando la aceptación y mejorando la conversión de cotizaciones enviadas a cotizaciones aceptadas.

El sistema capturará la firma mediante un canvas de dibujo, junto con metadatos de auditoría (nombre del firmante, timestamp, IP, user-agent) y actualizará el estado de la cotización a SIGNED.

## Glossary

- **Quote_System**: El sistema de gestión de cotizaciones QuoteFast
- **Signature_Service**: El servicio responsable de procesar y almacenar firmas electrónicas
- **Public_Quote_View**: La vista pública de cotización accesible vía /public/quotes/:publicId
- **Canvas_Signature**: Firma capturada mediante dibujo en elemento HTML canvas
- **Signature_Metadata**: Información de auditoría asociada a una firma (IP, user-agent, timestamp)
- **Active_Signature**: La firma válida y actual asociada a una cotización
- **Signable_Status**: Estados de cotización que permiten firma (SENT, VIEWED)
- **Signature_Image**: Representación visual de la firma en formato base64 o URL
- **Tracking_Event**: Evento registrado en el sistema de seguimiento de cotizaciones

## Requirements

### Requirement 1: Firma de Cotización desde Vista Pública

**User Story:** Como cliente, quiero firmar una cotización desde la vista pública, para formalizar mi aceptación de manera digital.

#### Acceptance Criteria

1. WHEN un cliente accede a una cotización con status SENT o VIEWED, THE Public_Quote_View SHALL mostrar la opción de firma
2. WHEN un cliente accede a una cotización con status diferente a SENT o VIEWED, THE Public_Quote_View SHALL ocultar la opción de firma
3. WHEN un cliente intenta firmar una cotización con status diferente a SENT o VIEWED, THE Quote_System SHALL rechazar la operación con código de error 400
4. THE Quote_System SHALL exponer un endpoint POST /public/quotes/:publicId/sign para procesar firmas

### Requirement 2: Captura de Datos de Firma

**User Story:** Como cliente, quiero proporcionar mi firma dibujada y mi nombre, para que quede registro de mi identidad y consentimiento.

#### Acceptance Criteria

1. THE Public_Quote_View SHALL proporcionar un canvas para dibujar la firma
2. THE Public_Quote_View SHALL proporcionar un campo de texto para el nombre del firmante
3. WHEN el cliente envía la firma, THE Signature_Service SHALL validar que el nombre del firmante no esté vacío
4. WHEN el cliente envía la firma, THE Signature_Service SHALL validar que la imagen de firma no esté vacía
5. WHEN la validación falla, THE Signature_Service SHALL retornar un error 400 con mensaje descriptivo
6. THE Signature_Service SHALL capturar la dirección IP del cliente
7. THE Signature_Service SHALL capturar el user-agent del cliente
8. THE Signature_Service SHALL registrar el timestamp de la firma

### Requirement 3: Almacenamiento de Firma

**User Story:** Como sistema, quiero almacenar la firma y sus metadatos de forma persistente, para mantener un registro auditable de la aceptación.

#### Acceptance Criteria

1. THE Signature_Service SHALL almacenar el nombre del firmante en la base de datos
2. THE Signature_Service SHALL almacenar la imagen de firma como URL o base64 en la base de datos
3. THE Signature_Service SHALL almacenar la dirección IP en la base de datos
4. THE Signature_Service SHALL almacenar el user-agent en la base de datos
5. THE Signature_Service SHALL almacenar el timestamp de firma en la base de datos
6. THE Signature_Service SHALL asociar la firma con la cotización mediante el campo quoteId
7. WHEN una cotización ya tiene una firma activa, THE Signature_Service SHALL reemplazar la firma anterior con la nueva
8. THE Signature_Service SHALL completar la operación de almacenamiento en menos de 500ms en el percentil 95

### Requirement 4: Cambio de Estado de Cotización

**User Story:** Como sistema, quiero actualizar el estado de la cotización al firmar, para reflejar que ha sido aceptada formalmente.

#### Acceptance Criteria

1. WHEN una firma es procesada exitosamente, THE Quote_System SHALL cambiar el status de la cotización a SIGNED
2. WHEN el status cambia a SIGNED, THE Quote_System SHALL registrar el timestamp en el campo signedAt
3. WHEN múltiples solicitudes de firma llegan simultáneamente para la misma cotización, THE Quote_System SHALL procesar solo una firma exitosamente
4. WHEN múltiples solicitudes de firma llegan simultáneamente para la misma cotización, THE Quote_System SHALL retornar error 409 para las solicitudes subsecuentes

### Requirement 5: Registro de Evento de Tracking

**User Story:** Como administrador del sistema, quiero que se registre un evento cuando una cotización es firmada, para tener trazabilidad completa del ciclo de vida.

#### Acceptance Criteria

1. WHEN una cotización es firmada exitosamente, THE Quote_System SHALL crear un evento de tipo QUOTE_SIGNED
2. THE Quote_System SHALL asociar el evento con la cotización mediante quoteId
3. THE Quote_System SHALL incluir la dirección IP en el evento de tracking
4. THE Quote_System SHALL incluir el user-agent en el evento de tracking
5. THE Quote_System SHALL incluir el nombre del firmante en los metadatos del evento

### Requirement 6: Validación de Integridad de Datos

**User Story:** Como sistema, quiero validar los datos de entrada, para prevenir almacenamiento de información inválida o maliciosa.

#### Acceptance Criteria

1. WHEN el nombre del firmante excede 255 caracteres, THE Signature_Service SHALL rechazar la solicitud con error 400
2. WHEN el nombre del firmante contiene solo espacios en blanco, THE Signature_Service SHALL rechazar la solicitud con error 400
3. WHEN la imagen de firma excede 5MB, THE Signature_Service SHALL rechazar la solicitud con error 400
4. WHEN el formato de imagen no es válido, THE Signature_Service SHALL rechazar la solicitud con error 400
5. THE Signature_Service SHALL sanitizar el nombre del firmante para prevenir inyección de código

### Requirement 7: Respuesta de API

**User Story:** Como desarrollador frontend, quiero recibir una respuesta estructurada al firmar, para actualizar la interfaz correctamente.

#### Acceptance Criteria

1. WHEN una firma es procesada exitosamente, THE Signature_Service SHALL retornar código HTTP 200
2. THE Signature_Service SHALL incluir el ID de la firma en la respuesta
3. THE Signature_Service SHALL incluir el nuevo status de la cotización en la respuesta
4. THE Signature_Service SHALL incluir el timestamp de firma en la respuesta
5. WHEN ocurre un error, THE Signature_Service SHALL retornar un mensaje de error descriptivo

### Requirement 8: Documentación de API

**User Story:** Como desarrollador, quiero que el endpoint de firma esté documentado en Swagger, para entender cómo integrarlo correctamente.

#### Acceptance Criteria

1. THE Quote_System SHALL incluir el endpoint POST /public/quotes/:publicId/sign en la documentación Swagger
2. THE Quote_System SHALL documentar el schema del request body en Swagger
3. THE Quote_System SHALL documentar los códigos de respuesta posibles en Swagger
4. THE Quote_System SHALL documentar el schema de la respuesta exitosa en Swagger
5. THE Quote_System SHALL incluir ejemplos de request y response en Swagger

### Requirement 9: Testing de Propiedades

**User Story:** Como desarrollador, quiero tests basados en propiedades para la firma, para garantizar robustez ante inputs variados.

#### Acceptance Criteria

1. THE Quote_System SHALL incluir property-based tests para validación de nombre del firmante
2. THE Quote_System SHALL incluir property-based tests para transiciones de estado de cotización
3. THE Quote_System SHALL incluir property-based tests para manejo de firmas concurrentes
4. FOR ALL nombres válidos generados aleatoriamente, la validación SHALL aceptar el nombre
5. FOR ALL nombres inválidos generados aleatoriamente, la validación SHALL rechazar el nombre

### Requirement 10: Idempotencia de Firma

**User Story:** Como sistema, quiero que firmar múltiples veces la misma cotización sea idempotente en el resultado final, para evitar estados inconsistentes.

#### Acceptance Criteria

1. WHEN una cotización es firmada múltiples veces por el mismo cliente, THE Quote_System SHALL mantener solo la firma más reciente
2. WHEN una cotización es firmada múltiples veces, THE Quote_System SHALL mantener el status SIGNED
3. FOR ALL secuencias de firmas sobre la misma cotización, el estado final SHALL ser consistente con la última firma procesada

