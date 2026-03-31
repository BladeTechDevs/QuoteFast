# Plan de Implementación: Catálogo de Productos y Plantillas de Cotizaciones con Ítems

## Visión General

Implementación incremental en NestJS (backend) y Next.js (frontend) de dos módulos complementarios: el Catálogo de Productos/Servicios (`CatalogItem`) y las Plantillas de Cotizaciones con Ítems (`QuoteTemplate` + `TemplateItem`). Se sigue la arquitectura existente de QuoteFast con Prisma + PostgreSQL, Jest y fast-check para tests.

## Tareas

- [x] 1. Migración de base de datos: modelos CatalogItem, QuoteTemplate y TemplateItem
  - Agregar los modelos `CatalogItem`, `QuoteTemplate` y `TemplateItem` al schema de Prisma en `test/backend/prisma/schema.prisma`
  - Agregar las relaciones `catalogItems` y `quoteTemplates` al modelo `User`
  - Agregar el campo opcional `quoteTemplateId` al modelo `Quote` (sin FK, referencia informativa)
  - Crear y ejecutar la migración con `npx prisma migrate dev`
  - _Requisitos: 1.1, 4.1, 8.1, 8.3_

- [x] 2. Backend: módulo CatalogModule (CRUD de CatalogItems)
  - [x] 2.1 Crear DTOs y estructura del módulo
    - Crear `test/backend/src/catalog/dto/create-catalog-item.dto.ts` con validaciones (`@IsNotEmpty`, `@MaxLength(255)`, `@IsNumber`, `@Min(0)`)
    - Crear `test/backend/src/catalog/dto/update-catalog-item.dto.ts` (PartialType de CreateCatalogItemDto)
    - Crear `test/backend/src/catalog/dto/list-catalog-items.dto.ts` con `page`, `limit`, `search`
    - Crear `test/backend/src/catalog/catalog.module.ts` y registrarlo en `AppModule`
    - _Requisitos: 1.3, 1.4, 1.11_

  - [x] 2.2 Implementar CatalogService
    - Crear `test/backend/src/catalog/catalog.service.ts` con métodos: `create`, `findAll` (paginado + búsqueda case-insensitive), `update` (patch), `remove`
    - Validar ownership en `update` y `remove` (lanzar `NotFoundException` si no pertenece al usuario)
    - _Requisitos: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 2.3 Implementar CatalogController
    - Crear `test/backend/src/catalog/catalog.controller.ts` con rutas `GET /api/catalog`, `POST /api/catalog`, `PATCH /api/catalog/:id`, `DELETE /api/catalog/:id`
    - Aplicar `@UseGuards(JwtAuthGuard)` a todos los endpoints
    - _Requisitos: 1.11_

  - [x] 2.4 Escribir tests unitarios para CatalogService
    - Crear `test/backend/src/catalog/catalog.service.spec.ts`
    - Cubrir: creación exitosa, listado paginado, búsqueda, update propio, update ajeno (404), delete propio, delete ajeno (404)
    - _Requisitos: 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 2.5 Escribir test de propiedad: aislamiento de datos por usuario (Propiedad 1)
    - Crear `test/backend/src/catalog/catalog.isolation.pbt.spec.ts`
    - **Propiedad 1: Aislamiento de datos del catálogo por usuario**
    - **Valida: Requisitos 1.1, 1.5**

  - [x] 2.6 Escribir tests de propiedad: round-trip y eliminación de CatalogItem (Propiedades 2 y 7)
    - Crear `test/backend/src/catalog/catalog.roundtrip.pbt.spec.ts`
    - **Propiedad 2: Round-trip de creación de CatalogItem**
    - **Propiedad 7: Eliminación permanente de CatalogItem**
    - **Valida: Requisitos 1.2, 1.9**

  - [x] 2.7 Escribir tests de propiedad: validación de name y unitPrice (Propiedades 3 y 4)
    - Crear `test/backend/src/catalog/catalog.validation.pbt.spec.ts`
    - **Propiedad 3: Validación de `name` de CatalogItem**
    - **Propiedad 4: Validación de `unitPrice` de CatalogItem**
    - **Valida: Requisitos 1.3, 1.4**

  - [x] 2.8 Escribir test de propiedad: filtrado de búsqueda (Propiedad 5)
    - Crear `test/backend/src/catalog/catalog.search.pbt.spec.ts`
    - **Propiedad 5: Filtrado de búsqueda en catálogo**
    - **Valida: Requisito 1.6**

  - [x] 2.9 Escribir test de propiedad: patch parcial preserva campos (Propiedad 6)
    - Crear `test/backend/src/catalog/catalog.patch.pbt.spec.ts`
    - **Propiedad 6: Patch parcial de CatalogItem preserva campos no modificados**
    - **Valida: Requisito 1.7**

- [x] 3. Checkpoint — Asegurarse de que todos los tests del módulo Catalog pasan
  - Asegurarse de que todos los tests pasan, consultar al usuario si surgen dudas.

- [x] 4. Backend: QuoteTemplatesModule (CRUD de QuoteTemplates con TemplateItems)
  - [x] 4.1 Crear DTOs para QuoteTemplate y TemplateItem
    - Crear `test/backend/src/templates/dto/template-item.dto.ts` con validaciones (`@IsNotEmpty`, `@MaxLength(255)`, `@IsNumber`, `@Min(0)`)
    - Crear `test/backend/src/templates/dto/create-quote-template.dto.ts` con campo `items?: TemplateItemDto[]`
    - Crear `test/backend/src/templates/dto/update-quote-template.dto.ts` (reemplaza TemplateItems completos)
    - Crear `test/backend/src/templates/dto/save-quote-as-template.dto.ts` con campo `name`
    - _Requisitos: 4.1, 4.2, 3.2_

  - [x] 4.2 Implementar QuoteTemplatesService
    - Crear `test/backend/src/templates/quote-templates.service.ts`
    - Método `create`: crea QuoteTemplate con TemplateItems en una transacción
    - Método `findAll`: retorna plantillas propias del usuario + plantillas del sistema (`isDefault = true`), incluyendo TemplateItems
    - Método `findOne`: retorna plantilla con TemplateItems ordenados por `order`
    - Método `update`: actualiza metadatos y reemplaza TemplateItems (delete + create en transacción); lanza 403 si `isDefault = true`
    - Método `remove`: elimina plantilla (cascade elimina TemplateItems); lanza 403 si `isDefault = true`
    - _Requisitos: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 4.3 Implementar endpoint `POST /api/quotes/:id/save-as-template` en QuotesController
    - Agregar método `saveAsTemplate` en `QuotesService` que copia metadatos de la Quote y sus QuoteItems como TemplateItems
    - Registrar el endpoint en `QuotesController` con `@UseGuards(JwtAuthGuard)`
    - Lanzar 404 si la Quote no pertenece al usuario
    - _Requisitos: 3.1, 3.3, 3.4, 3.5_

  - [x] 4.4 Implementar QuoteTemplatesController
    - Crear `test/backend/src/templates/quote-templates.controller.ts` con rutas `GET /api/quote-templates`, `GET /api/quote-templates/:id`, `POST /api/quote-templates`, `PATCH /api/quote-templates/:id`, `DELETE /api/quote-templates/:id`
    - Registrar en `TemplatesModule` con `@UseGuards(JwtAuthGuard)`
    - _Requisitos: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 2.10 Escribir tests unitarios para QuoteTemplatesService
    - Crear `test/backend/src/templates/quote-templates.service.spec.ts`
    - Cubrir: creación con ítems, listado (propias + sistema), detalle ordenado, update (reemplaza ítems), update plantilla sistema (403), delete propio, delete sistema (403), saveAsTemplate
    - _Requisitos: 3.1, 3.4, 3.5, 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 4.5 Escribir tests de propiedad: round-trip guardar Quote como plantilla y copia de ítems (Propiedades 9 y 16)
    - Crear `test/backend/src/templates/quote-templates.roundtrip.pbt.spec.ts`
    - **Propiedad 9: Round-trip de guardar Quote como QuoteTemplate**
    - **Propiedad 16: Round-trip de copia de TemplateItems a QuoteItems**
    - **Valida: Requisitos 3.1, 3.3, 3.4, 5.2, 8.5**

  - [x] 4.6 Escribir tests de propiedad: validación de QuoteTemplate y TemplateItem (Propiedades 10 y 11)
    - Crear `test/backend/src/templates/quote-templates.validation.pbt.spec.ts`
    - **Propiedad 10: Validación de `name` de QuoteTemplate**
    - **Propiedad 11: Validación de TemplateItem (name y unitPrice/quantity)**
    - **Valida: Requisitos 3.2, 4.2, 8.4**

  - [x] 4.7 Escribir tests de propiedad: lista incluye plantillas del sistema y orden de ítems (Propiedades 12 y 13)
    - Crear `test/backend/src/templates/quote-templates.list.pbt.spec.ts`
    - **Propiedad 12: Lista de QuoteTemplates incluye plantillas del sistema**
    - **Propiedad 13: TemplateItems ordenados por `order`**
    - **Valida: Requisitos 4.3, 4.4**

  - [x] 4.8 Escribir test de propiedad: actualización reemplaza TemplateItems (Propiedad 14)
    - Crear `test/backend/src/templates/quote-templates.update.pbt.spec.ts`
    - **Propiedad 14: Actualización de QuoteTemplate reemplaza TemplateItems**
    - **Valida: Requisito 4.5**

  - [x] 4.9 Escribir test de propiedad: eliminación en cascada de TemplateItems (Propiedad 15)
    - Crear `test/backend/src/templates/quote-templates.cascade.pbt.spec.ts`
    - **Propiedad 15: Eliminación en cascada de TemplateItems**
    - **Valida: Requisitos 4.7, 8.1**

- [x] 5. Backend: extensión de QuotesService para crear Quote desde QuoteTemplate con ítems
  - [x] 5.1 Extender `QuotesService.create()` para soportar `templateId` apuntando a `QuoteTemplate`
    - Modificar `test/backend/src/quotes/quotes.service.ts`: si `templateId` corresponde a una `QuoteTemplate`, pre-llenar metadatos y crear `QuoteItems` copiando los `TemplateItems`
    - Aplicar precedencia del DTO sobre la plantilla para campos coincidentes
    - Calcular `total` de cada `QuoteItem` y recalcular `subtotal`, `taxAmount`, `total` de la Quote
    - Lanzar 404 si el `templateId` no existe o no es accesible
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.2 Escribir tests de propiedad: totales calculados y precedencia del DTO (Propiedades 17 y 18)
    - Crear `test/backend/src/quotes/quotes.template-copy.pbt.spec.ts`
    - **Propiedad 17: Totales calculados correctamente al crear Quote desde plantilla**
    - **Propiedad 18: Precedencia del DTO sobre la plantilla**
    - **Valida: Requisitos 5.3, 5.4**

  - [x] 5.3 Escribir tests de propiedad: independencia de datos al eliminar CatalogItem o QuoteTemplate (Propiedades 19 y 20)
    - Crear `test/backend/src/quotes/quotes.data-independence.pbt.spec.ts`
    - **Propiedad 19: Independencia de QuoteItems al eliminar CatalogItem**
    - **Propiedad 20: Independencia de Quotes al eliminar QuoteTemplate**
    - **Valida: Requisitos 8.2, 8.3**

- [x] 6. Checkpoint — Asegurarse de que todos los tests del backend pasan
  - Asegurarse de que todos los tests pasan, consultar al usuario si surgen dudas.

- [x] 7. Frontend: página `/catalog` y gestión de CatalogItems
  - [x] 7.1 Crear hook `useCatalog` y cliente API
    - Crear `test/frontend/src/lib/hooks/useCatalog.ts` con React Query: `useListCatalogItems`, `useCreateCatalogItem`, `useUpdateCatalogItem`, `useDeleteCatalogItem`
    - Agregar funciones de API en `test/frontend/src/lib/api/catalog.ts` (GET, POST, PATCH, DELETE a `/api/catalog`)
    - _Requisitos: 6.1, 6.2_

  - [x] 7.2 Crear componente `CatalogItemModal`
    - Crear `test/frontend/src/components/catalog/CatalogItemModal.tsx` con formulario para crear/editar CatalogItem
    - Incluir validación en cliente (name no vacío, unitPrice >= 0) antes de enviar
    - Mostrar mensaje de error descriptivo si el backend retorna error
    - _Requisitos: 6.3, 6.5_

  - [x] 7.3 Crear página `/catalog`
    - Crear `test/frontend/src/app/(app)/catalog/page.tsx` con tabla de CatalogItems (columnas: name, description, unitPrice, taxRate, acciones)
    - Incluir botón de crear, acciones de editar y eliminar con confirmación explícita
    - Mostrar mensaje si el catálogo está vacío con enlace para agregar el primer ítem
    - Agregar enlace `/catalog` al menú de navegación principal
    - _Requisitos: 6.1, 6.2, 6.4, 6.5, 2.5_

- [x] 8. Frontend: componente `CatalogSearch` para QuoteEditor
  - [x] 8.1 Crear componente `CatalogSearch`
    - Crear `test/frontend/src/components/catalog/CatalogSearch.tsx` con campo de búsqueda con debounce de 300ms
    - Al seleccionar un CatalogItem, pre-llenar los campos del QuoteItem (`name`, `description`, `unitPrice`, `taxRate`, `discount`, `internalCost`)
    - Mostrar mensaje si el catálogo está vacío con enlace para agregar ítems
    - _Requisitos: 2.1, 2.2, 2.4, 2.5_

  - [x] 8.2 Integrar `CatalogSearch` en el formulario de ítems del QuoteEditor
    - Modificar el componente de formulario de QuoteItem en `test/frontend/src/` para incluir `CatalogSearch`
    - El usuario puede modificar cualquier campo pre-llenado antes de confirmar
    - Al confirmar, enviar `POST /api/quotes/:id/items` con los datos finales
    - _Requisitos: 2.2, 2.3_

  - [x] 8.3 Escribir test de propiedad: pre-llenado de QuoteItem desde CatalogItem (Propiedad 8)
    - Crear `test/frontend/src/components/catalog/CatalogSearch.prefill.pbt.test.tsx`
    - **Propiedad 8: Pre-llenado de QuoteItem desde CatalogItem**
    - **Valida: Requisito 2.1**

- [x] 9. Frontend: gestión de QuoteTemplates con TemplateItems
  - [x] 9.1 Crear hook `useQuoteTemplates` y cliente API
    - Crear `test/frontend/src/lib/hooks/useQuoteTemplates.ts` con React Query para listar, crear, actualizar, eliminar QuoteTemplates y guardar Quote como plantilla
    - Agregar funciones de API en `test/frontend/src/lib/api/quote-templates.ts`
    - _Requisitos: 4.3, 7.1, 7.4, 7.5_

  - [x] 9.2 Crear componente `TemplateItemsEditor`
    - Crear `test/frontend/src/components/templates/TemplateItemsEditor.tsx` con lista editable de TemplateItems (agregar, editar, eliminar)
    - En modo solo lectura (plantillas del sistema), mostrar ítems sin controles de edición
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 9.3 Extender `TemplateModal` con soporte para TemplateItems
    - Modificar `test/frontend/src/components/templates/TemplateModal.tsx` para incluir `TemplateItemsEditor`
    - Enviar la lista completa de TemplateItems al crear o actualizar una QuoteTemplate
    - _Requisitos: 4.1, 4.5, 7.2_

  - [x] 9.4 Agregar botón "Guardar como plantilla" en la vista de detalle de Quote
    - Modificar la vista de detalle de Quote para incluir el botón "Guardar como plantilla"
    - Abrir un modal para ingresar el nombre de la nueva QuoteTemplate
    - Al confirmar, enviar `POST /api/quotes/:id/save-as-template` y mostrar mensaje de confirmación con el nombre de la plantilla creada
    - _Requisitos: 7.4, 7.5_

- [x] 10. Checkpoint final — Asegurarse de que todos los tests pasan
  - Asegurarse de que todos los tests pasan, consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los tests de propiedades usan fast-check con mínimo 100 iteraciones por propiedad
- Los tests unitarios y de propiedades son complementarios; ambos son necesarios para cobertura completa
- Los checkpoints garantizan validación incremental antes de avanzar al siguiente módulo
