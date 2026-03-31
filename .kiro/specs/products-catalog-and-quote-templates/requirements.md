# Documento de Requisitos

## Introducción

Este documento describe los requisitos para dos nuevas funcionalidades del sistema QuoteFast:

1. **Catálogo de Productos/Servicios**: Un módulo que permite al usuario registrar y gestionar un catálogo propio de productos o servicios reutilizables. Al crear o editar una cotización, el usuario puede buscar y agregar ítems directamente desde su catálogo, evitando escribirlos desde cero en cada cotización.

2. **Plantillas de Cotizaciones**: Extensión del sistema de plantillas existente para permitir que el usuario guarde cotizaciones completas (con ítems incluidos) como plantillas reutilizables. El usuario puede crear una cotización nueva a partir de una plantilla, modificarla y enviarla al cliente.

Ambas funcionalidades apuntan a reducir el tiempo de creación de cotizaciones y mejorar la consistencia de los datos entre cotizaciones del mismo usuario.

---

## Glosario

- **Catalog**: Módulo del sistema que gestiona los productos y servicios reutilizables de un usuario.
- **CatalogItem**: Producto o servicio registrado en el catálogo de un usuario. Contiene nombre, descripción, precio unitario, impuesto, descuento y costo interno.
- **QuoteTemplate**: Plantilla de cotización que incluye metadatos (moneda, impuesto, descuento, notas, términos) e ítems predefinidos. Puede ser del sistema (`isDefault = true`) o creada por el usuario.
- **TemplateItem**: Ítem predefinido dentro de una QuoteTemplate. Equivalente a un QuoteItem pero asociado a una plantilla en lugar de a una cotización activa.
- **Quote**: Cotización activa en el sistema, en cualquier estado de su ciclo de vida.
- **QuoteItem**: Línea de detalle de una cotización activa.
- **User**: Usuario autenticado de la plataforma QuoteFast.
- **System**: El backend de QuoteFast (NestJS/Prisma).
- **Frontend**: La aplicación web de QuoteFast (Next.js/React).

---

## Requisitos

### Requisito 1: Gestión del Catálogo de Productos/Servicios

**User Story:** Como usuario, quiero registrar y gestionar un catálogo de productos y servicios propios, para poder reutilizarlos al crear cotizaciones sin tener que escribirlos desde cero cada vez.

#### Criterios de Aceptación

1. THE System SHALL asociar cada CatalogItem a un único User mediante una relación de clave foránea.
2. WHEN el User envía una solicitud de creación con `name`, `unitPrice` y al menos uno de los campos opcionales válidos, THE System SHALL crear un CatalogItem y retornar el objeto creado con su `id` generado.
3. THE System SHALL requerir que el campo `name` de un CatalogItem no esté vacío y no supere 255 caracteres.
4. THE System SHALL requerir que el campo `unitPrice` de un CatalogItem sea un número decimal mayor o igual a 0.
5. WHEN el User solicita la lista de sus CatalogItems, THE System SHALL retornar únicamente los CatalogItems que pertenecen a ese User, con paginación (`page`, `limit`) y el total de registros.
6. WHEN el User proporciona un término de búsqueda, THE System SHALL filtrar los CatalogItems cuyo `name` o `description` contengan el término de forma insensible a mayúsculas.
7. WHEN el User solicita actualizar un CatalogItem que le pertenece, THE System SHALL aplicar los cambios parciales (patch) y retornar el objeto actualizado.
8. IF el User solicita actualizar un CatalogItem que no le pertenece o no existe, THEN THE System SHALL retornar un error 404.
9. WHEN el User solicita eliminar un CatalogItem que le pertenece, THE System SHALL eliminar el registro de forma permanente.
10. IF el User solicita eliminar un CatalogItem que no le pertenece o no existe, THEN THE System SHALL retornar un error 404.
11. THE System SHALL exponer los endpoints del Catalog bajo autenticación JWT, rechazando solicitudes sin token válido con un error 401.

---

### Requisito 2: Agregar Ítems del Catálogo a una Cotización

**User Story:** Como usuario, quiero buscar y seleccionar ítems de mi catálogo al editar una cotización, para agregarlos como QuoteItems sin tener que escribir los datos manualmente.

#### Criterios de Aceptación

1. WHEN el User selecciona un CatalogItem para agregarlo a una Quote, THE Frontend SHALL pre-llenar los campos del nuevo QuoteItem con los valores del CatalogItem (`name`, `description`, `unitPrice`, `taxRate`, `discount`, `internalCost`).
2. THE Frontend SHALL permitir al User modificar cualquier campo del QuoteItem pre-llenado antes de confirmarlo.
3. WHEN el User confirma el QuoteItem pre-llenado, THE Frontend SHALL enviar la solicitud de creación al endpoint existente `POST /api/quotes/:id/items` con los datos finales.
4. THE Frontend SHALL mostrar un campo de búsqueda en el formulario de ítems que filtre los CatalogItems del User en tiempo real con un debounce de 300ms.
5. IF el User no tiene CatalogItems registrados, THEN THE Frontend SHALL mostrar un mensaje indicando que el catálogo está vacío y un enlace para agregar el primer ítem.

---

### Requisito 3: Guardar una Cotización como Plantilla

**User Story:** Como usuario, quiero guardar una cotización existente como plantilla reutilizable, para poder crear cotizaciones similares en el futuro sin empezar desde cero.

#### Criterios de Aceptación

1. WHEN el User solicita guardar una Quote como QuoteTemplate, THE System SHALL crear una nueva QuoteTemplate con los metadatos de la Quote (`currency`, `taxRate`, `discount`, `notes`, `terms`) y copiar todos sus QuoteItems como TemplateItems.
2. THE System SHALL requerir que el User proporcione un `name` para la QuoteTemplate al guardarla, con un máximo de 255 caracteres.
3. THE System SHALL asociar la QuoteTemplate creada al User que realizó la solicitud, con `isDefault = false`.
4. WHEN la QuoteTemplate es creada a partir de una Quote, THE System SHALL retornar el objeto de la QuoteTemplate con sus TemplateItems incluidos.
5. IF la Quote de origen no pertenece al User o no existe, THEN THE System SHALL retornar un error 404.

---

### Requisito 4: Gestión de Plantillas de Cotización con Ítems

**User Story:** Como usuario, quiero crear, editar y eliminar mis plantillas de cotización incluyendo sus ítems predefinidos, para mantener un conjunto de plantillas actualizado y relevante.

#### Criterios de Aceptación

1. WHEN el User crea una QuoteTemplate manualmente, THE System SHALL permitir incluir una lista de TemplateItems en la misma solicitud de creación.
2. THE System SHALL requerir que cada TemplateItem tenga `name` y `unitPrice` válidos (mismas reglas que QuoteItem).
3. WHEN el User solicita la lista de sus QuoteTemplates, THE System SHALL retornar las plantillas propias del User más las plantillas del sistema (`isDefault = true`, `userId = null`), incluyendo sus TemplateItems.
4. WHEN el User solicita el detalle de una QuoteTemplate, THE System SHALL retornar la plantilla con todos sus TemplateItems ordenados por el campo `order`.
5. WHEN el User actualiza una QuoteTemplate propia, THE System SHALL aplicar los cambios a los metadatos y reemplazar la lista de TemplateItems con la nueva lista proporcionada.
6. IF el User intenta actualizar una QuoteTemplate del sistema (`isDefault = true`), THEN THE System SHALL retornar un error 403.
7. WHEN el User elimina una QuoteTemplate propia, THE System SHALL eliminar la plantilla y todos sus TemplateItems en cascada.
8. IF el User intenta eliminar una QuoteTemplate del sistema, THEN THE System SHALL retornar un error 403.

---

### Requisito 5: Crear una Cotización a partir de una Plantilla con Ítems

**User Story:** Como usuario, quiero crear una cotización nueva a partir de una plantilla que incluya ítems predefinidos, para tener una cotización lista para editar y enviar en el menor tiempo posible.

#### Criterios de Aceptación

1. WHEN el User crea una Quote proporcionando un `templateId`, THE System SHALL pre-llenar los campos de la Quote con los metadatos de la QuoteTemplate (`currency`, `taxRate`, `discount`, `notes`, `terms`).
2. WHEN el User crea una Quote a partir de una QuoteTemplate que tiene TemplateItems, THE System SHALL crear QuoteItems en la nueva Quote copiando los datos de cada TemplateItem (`name`, `description`, `quantity`, `unitPrice`, `discount`, `taxRate`, `internalCost`, `order`).
3. THE System SHALL calcular el `total` de cada QuoteItem copiado y recalcular los totales de la Quote (`subtotal`, `taxAmount`, `total`) inmediatamente después de la creación.
4. WHEN el User proporciona campos en el DTO de creación de Quote que coinciden con campos de la plantilla, THE System SHALL usar los valores del DTO en lugar de los de la plantilla (el DTO tiene precedencia).
5. IF el `templateId` proporcionado no existe o no es accesible para el User, THEN THE System SHALL retornar un error 404.

---

### Requisito 6: Interfaz de Usuario para el Catálogo

**User Story:** Como usuario, quiero una sección dedicada en el panel de administración para gestionar mi catálogo de productos y servicios, para poder agregar, editar y eliminar ítems de forma intuitiva.

#### Criterios de Aceptación

1. THE Frontend SHALL proveer una ruta `/catalog` accesible desde el menú de navegación principal para gestionar el catálogo del User.
2. THE Frontend SHALL mostrar la lista de CatalogItems del User en una tabla con columnas para `name`, `description`, `unitPrice`, `taxRate` y acciones (editar, eliminar).
3. THE Frontend SHALL proveer un formulario modal o de página para crear y editar CatalogItems con validación en el cliente antes de enviar la solicitud.
4. WHEN el User confirma la eliminación de un CatalogItem, THE Frontend SHALL solicitar confirmación explícita antes de enviar la solicitud de eliminación al System.
5. WHEN el System retorna un error en cualquier operación del catálogo, THE Frontend SHALL mostrar un mensaje de error descriptivo al User.

---

### Requisito 7: Interfaz de Usuario para Plantillas con Ítems

**User Story:** Como usuario, quiero gestionar mis plantillas de cotización incluyendo sus ítems desde el panel de administración, para tener control total sobre el contenido de cada plantilla.

#### Criterios de Aceptación

1. THE Frontend SHALL mostrar los TemplateItems de cada QuoteTemplate en la vista de detalle o edición de la plantilla.
2. THE Frontend SHALL permitir al User agregar, editar y eliminar TemplateItems dentro del formulario de edición de una QuoteTemplate propia.
3. WHEN el User visualiza una QuoteTemplate del sistema, THE Frontend SHALL mostrar los TemplateItems en modo solo lectura, sin controles de edición.
4. THE Frontend SHALL mostrar un botón "Guardar como plantilla" en la vista de detalle de una Quote, que abra un modal para ingresar el nombre de la nueva QuoteTemplate.
5. WHEN el User confirma guardar la Quote como QuoteTemplate, THE Frontend SHALL enviar la solicitud al System y mostrar un mensaje de confirmación con el nombre de la plantilla creada.

---

### Requisito 8: Integridad y Consistencia de Datos

**User Story:** Como usuario, quiero que el sistema mantenga la integridad de los datos del catálogo y las plantillas, para que mis cotizaciones sean siempre consistentes y confiables.

#### Criterios de Aceptación

1. THE System SHALL almacenar los TemplateItems como registros independientes en la base de datos, vinculados a su QuoteTemplate mediante clave foránea con eliminación en cascada.
2. WHEN un CatalogItem es eliminado, THE System SHALL conservar los QuoteItems existentes que fueron creados a partir de ese CatalogItem, sin modificarlos.
3. WHEN una QuoteTemplate es eliminada, THE System SHALL conservar las Quotes existentes que fueron creadas a partir de esa plantilla, sin modificarlas.
4. THE System SHALL validar que `unitPrice` y `quantity` de un TemplateItem sean valores decimales mayores o iguales a 0 antes de persistirlos.
5. FOR ALL QuoteTemplates con TemplateItems, crear una Quote a partir de la plantilla y luego leer los QuoteItems de la Quote SHALL producir ítems con los mismos valores de `name`, `unitPrice`, `quantity`, `taxRate` y `discount` que los TemplateItems originales (propiedad de round-trip de copia de datos).
