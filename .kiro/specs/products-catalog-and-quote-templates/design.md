# Documento de Diseño Técnico

## Feature: Catálogo de Productos/Servicios y Plantillas de Cotizaciones con Ítems

---

## Visión General

Esta feature extiende QuoteFast con dos capacidades complementarias:

1. **Catálogo de Productos/Servicios (`CatalogItem`)**: Un módulo independiente que permite a cada usuario registrar sus productos y servicios reutilizables. Al crear o editar una cotización, el usuario puede buscar ítems del catálogo y pre-llenar los campos del `QuoteItem` automáticamente.

2. **Plantillas de Cotizaciones con Ítems (`QuoteTemplate` + `TemplateItem`)**: Extensión del sistema de plantillas existente para soportar ítems predefinidos. El usuario puede guardar una cotización completa como plantilla, o crear plantillas manualmente con sus propios ítems. Al crear una cotización desde una plantilla, los ítems se copian automáticamente.

Ambas funcionalidades reducen el tiempo de creación de cotizaciones y mejoran la consistencia de los datos.

---

## Arquitectura

El sistema sigue la arquitectura existente de QuoteFast:

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  /catalog  ──► CatalogPage + CatalogItemModal               │
│  /templates ──► TemplatesPage (extendida con TemplateItems) │
│  /quotes/:id ──► QuoteEditor (extendida con CatalogSearch)  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP / JWT
┌──────────────────────▼──────────────────────────────────────┐
│                    NestJS Backend                            │
│  CatalogModule  ──► /api/catalog                            │
│  TemplatesModule (extendido) ──► /api/templates             │
│  QuotesModule (extendido) ──► /api/quotes                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL                                │
│  catalog_items, quote_templates (renombrado), template_items│
└─────────────────────────────────────────────────────────────┘
```

### Decisiones de diseño

**Modelo `Template` existente vs nuevo modelo `QuoteTemplate`**: El modelo `Template` actual almacena el contenido como un campo `Json` sin ítems estructurados. Para soportar `TemplateItems` como registros independientes con integridad referencial, se crea un nuevo modelo `QuoteTemplate` con una relación `1:N` a `TemplateItem`. El modelo `Template` existente se mantiene para compatibilidad hacia atrás durante la transición.

**`CatalogItem` como entidad independiente**: Los ítems del catálogo no tienen relación de clave foránea con `QuoteItem`. Cuando un usuario agrega un ítem del catálogo a una cotización, los datos se copian al `QuoteItem`. Esto garantiza que eliminar un `CatalogItem` no afecta las cotizaciones existentes (Requisito 8.2).

**Precedencia del DTO sobre la plantilla**: Al crear una cotización con `templateId`, los campos explícitos del DTO tienen precedencia sobre los valores de la plantilla. Esto sigue el patrón ya implementado en `QuotesService.create()`.

---

## Componentes e Interfaces

### Backend

#### Nuevo módulo: `CatalogModule`

```
src/catalog/
  catalog.controller.ts
  catalog.service.ts
  catalog.module.ts
  dto/
    create-catalog-item.dto.ts
    update-catalog-item.dto.ts
    list-catalog-items.dto.ts
```

**Endpoints REST:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/catalog` | Listar CatalogItems del usuario (paginado, con búsqueda) |
| `POST` | `/api/catalog` | Crear CatalogItem |
| `PATCH` | `/api/catalog/:id` | Actualizar CatalogItem (patch parcial) |
| `DELETE` | `/api/catalog/:id` | Eliminar CatalogItem |

Todos los endpoints requieren JWT (`@UseGuards(JwtAuthGuard)`).

#### Extensión de `TemplatesModule`

El módulo de plantillas se extiende para soportar `QuoteTemplate` + `TemplateItem`:

```
src/templates/
  templates.controller.ts       (extendido)
  templates.service.ts          (extendido)
  quote-templates.service.ts    (nuevo)
  dto/
    create-quote-template.dto.ts
    update-quote-template.dto.ts
    save-quote-as-template.dto.ts
    template-item.dto.ts
```

**Nuevos endpoints REST:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/quote-templates` | Listar QuoteTemplates (propias + sistema) con TemplateItems |
| `GET` | `/api/quote-templates/:id` | Detalle de QuoteTemplate con TemplateItems ordenados |
| `POST` | `/api/quote-templates` | Crear QuoteTemplate con TemplateItems opcionales |
| `PATCH` | `/api/quote-templates/:id` | Actualizar QuoteTemplate y reemplazar TemplateItems |
| `DELETE` | `/api/quote-templates/:id` | Eliminar QuoteTemplate y sus TemplateItems en cascada |
| `POST` | `/api/quotes/:id/save-as-template` | Guardar Quote como QuoteTemplate |

#### Extensión de `QuotesModule`

`QuotesService.create()` se extiende para soportar `templateId` apuntando a `QuoteTemplate` (con ítems). La lógica existente de `templateId` para `Template` se mantiene para compatibilidad.

### Frontend

#### Nueva página: `/catalog`

```
src/app/(app)/catalog/
  page.tsx
src/components/catalog/
  CatalogItemModal.tsx
  CatalogSearch.tsx          (componente de búsqueda para QuoteEditor)
src/lib/hooks/
  useCatalog.ts
```

#### Extensión de `/templates`

```
src/components/templates/
  TemplateModal.tsx           (extendido con TemplateItems)
  TemplateItemsEditor.tsx     (nuevo: lista editable de TemplateItems)
src/lib/hooks/
  useQuoteTemplates.ts        (nuevo)
```

#### Extensión de `QuoteEditor`

El componente `QuoteEditor` se extiende con:
- Un campo de búsqueda de catálogo con debounce de 300ms
- Pre-llenado de campos al seleccionar un `CatalogItem`
- Botón "Guardar como plantilla" en la vista de detalle de Quote

---

## Modelos de Datos

### Nuevos modelos Prisma

```prisma
model CatalogItem {
  id           String   @id @default(uuid())
  userId       String
  name         String   @db.VarChar(255)
  description  String?
  unitPrice    Decimal  @db.Decimal(12, 2)
  taxRate      Decimal  @default(0) @db.Decimal(5, 2)
  discount     Decimal  @default(0) @db.Decimal(12, 2)
  internalCost Decimal  @default(0) @db.Decimal(12, 2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, name])
}

model QuoteTemplate {
  id        String         @id @default(uuid())
  userId    String?
  name      String         @db.VarChar(255)
  currency  String         @default("USD")
  taxRate   Decimal        @default(0) @db.Decimal(5, 2)
  discount  Decimal        @default(0) @db.Decimal(12, 2)
  notes     String?
  terms     String?
  isDefault Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  user      User?          @relation(fields: [userId], references: [id])
  items     TemplateItem[]

  @@index([userId])
  @@index([isDefault])
}

model TemplateItem {
  id           String        @id @default(uuid())
  templateId   String
  name         String        @db.VarChar(255)
  description  String?
  quantity     Decimal       @default(1) @db.Decimal(10, 2)
  unitPrice    Decimal       @db.Decimal(12, 2)
  discount     Decimal       @default(0) @db.Decimal(12, 2)
  taxRate      Decimal       @default(0) @db.Decimal(5, 2)
  internalCost Decimal       @default(0) @db.Decimal(12, 2)
  order        Int
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  template     QuoteTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
}
```

### Extensión del modelo `User`

```prisma
model User {
  // ... campos existentes ...
  catalogItems   CatalogItem[]
  quoteTemplates QuoteTemplate[]
}
```

### Extensión del modelo `Quote`

Se agrega un campo opcional `quoteTemplateId` para rastrear la plantilla de origen (sin FK obligatoria, para cumplir Requisito 8.3):

```prisma
model Quote {
  // ... campos existentes ...
  quoteTemplateId String?   // referencia informativa, sin FK para preservar quotes al eliminar plantilla
}
```

### DTOs principales

**`CreateCatalogItemDto`**:
```typescript
{
  name: string;          // @IsNotEmpty(), @MaxLength(255)
  description?: string;
  unitPrice: number;     // @IsNumber(), @Min(0)
  taxRate?: number;      // @IsNumber(), @Min(0), @Max(100)
  discount?: number;     // @IsNumber(), @Min(0)
  internalCost?: number; // @IsNumber(), @Min(0)
}
```

**`CreateQuoteTemplateDto`**:
```typescript
{
  name: string;          // @IsNotEmpty(), @MaxLength(255)
  currency?: string;
  taxRate?: number;
  discount?: number;
  notes?: string;
  terms?: string;
  items?: TemplateItemDto[];
}
```

**`TemplateItemDto`**:
```typescript
{
  name: string;          // @IsNotEmpty(), @MaxLength(255)
  description?: string;
  quantity?: number;     // @IsNumber(), @Min(0)
  unitPrice: number;     // @IsNumber(), @Min(0)
  discount?: number;
  taxRate?: number;
  internalCost?: number;
  order: number;
}
```

**`SaveQuoteAsTemplateDto`**:
```typescript
{
  name: string;          // @IsNotEmpty(), @MaxLength(255)
}
```

**`ListCatalogItemsDto`**:
```typescript
{
  page?: number;
  limit?: number;
  search?: string;       // filtra por name o description (case-insensitive)
}
```

---

## Propiedades de Corrección

*Una propiedad es una característica o comportamiento que debe ser verdadero en todas las ejecuciones válidas de un sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquinas.*

### Propiedad 1: Aislamiento de datos del catálogo por usuario

*Para cualquier* conjunto de usuarios con CatalogItems, la lista de CatalogItems retornada para un usuario dado debe contener únicamente ítems cuyo `userId` coincide con el usuario solicitante.

**Valida: Requisitos 1.1, 1.5**

---

### Propiedad 2: Round-trip de creación de CatalogItem

*Para cualquier* conjunto válido de datos de CatalogItem (name no vacío, unitPrice >= 0), crear el ítem y luego buscarlo por su `id` debe retornar un objeto con los mismos valores de `name`, `unitPrice`, `taxRate`, `discount` e `internalCost`.

**Valida: Requisitos 1.2**

---

### Propiedad 3: Validación de `name` de CatalogItem

*Para cualquier* string, intentar crear un CatalogItem con ese string como `name` debe ser rechazado si y solo si el string está vacío (o compuesto solo de espacios) o supera 255 caracteres.

**Valida: Requisitos 1.3**

---

### Propiedad 4: Validación de `unitPrice` de CatalogItem

*Para cualquier* número, intentar crear un CatalogItem con ese número como `unitPrice` debe ser rechazado si y solo si el número es menor que 0.

**Valida: Requisitos 1.4**

---

### Propiedad 5: Filtrado de búsqueda en catálogo

*Para cualquier* término de búsqueda y lista de CatalogItems del usuario, todos los ítems retornados por la búsqueda deben contener el término (de forma insensible a mayúsculas) en su `name` o `description`, y ningún ítem que no contenga el término debe aparecer en los resultados.

**Valida: Requisitos 1.6**

---

### Propiedad 6: Patch parcial de CatalogItem preserva campos no modificados

*Para cualquier* CatalogItem existente y cualquier subconjunto de campos a actualizar, después del patch los campos actualizados deben tener los nuevos valores y los campos no incluidos en el patch deben mantener sus valores originales.

**Valida: Requisitos 1.7**

---

### Propiedad 7: Eliminación permanente de CatalogItem

*Para cualquier* CatalogItem que pertenece al usuario, después de eliminarlo, intentar buscarlo por su `id` debe retornar un resultado vacío (el registro no existe).

**Valida: Requisitos 1.9**

---

### Propiedad 8: Pre-llenado de QuoteItem desde CatalogItem

*Para cualquier* CatalogItem, cuando el usuario lo selecciona para agregar a una cotización, los campos `name`, `description`, `unitPrice`, `taxRate`, `discount` e `internalCost` del nuevo QuoteItem pre-llenado deben ser iguales a los valores correspondientes del CatalogItem.

**Valida: Requisitos 2.1**

---

### Propiedad 9: Round-trip de guardar Quote como QuoteTemplate

*Para cualquier* Quote con QuoteItems, guardarla como QuoteTemplate debe producir una QuoteTemplate con los mismos valores de `currency`, `taxRate`, `discount`, `notes` y `terms`, y con TemplateItems que tienen los mismos valores de `name`, `description`, `quantity`, `unitPrice`, `discount`, `taxRate`, `internalCost` y `order` que los QuoteItems originales.

**Valida: Requisitos 3.1, 3.3, 3.4**

---

### Propiedad 10: Validación de `name` de QuoteTemplate

*Para cualquier* string, intentar crear o guardar una QuoteTemplate con ese string como `name` debe ser rechazado si y solo si el string está vacío o supera 255 caracteres.

**Valida: Requisitos 3.2**

---

### Propiedad 11: Validación de TemplateItem (name y unitPrice/quantity)

*Para cualquier* lista de TemplateItems, crear una QuoteTemplate con esa lista debe ser rechazado si algún ítem tiene `name` vacío, `unitPrice` < 0 o `quantity` < 0.

**Valida: Requisitos 4.2, 8.4**

---

### Propiedad 12: Lista de QuoteTemplates incluye plantillas del sistema

*Para cualquier* usuario, la lista de QuoteTemplates retornada debe incluir todas las plantillas con `isDefault = true` (plantillas del sistema) además de las plantillas propias del usuario, y cada plantilla debe incluir sus TemplateItems.

**Valida: Requisitos 4.3**

---

### Propiedad 13: TemplateItems ordenados por `order`

*Para cualquier* QuoteTemplate con TemplateItems, el detalle de la plantilla debe retornar los TemplateItems en orden ascendente por el campo `order`.

**Valida: Requisitos 4.4**

---

### Propiedad 14: Actualización de QuoteTemplate reemplaza TemplateItems

*Para cualquier* QuoteTemplate propia y cualquier nueva lista de TemplateItems, después de actualizar la plantilla con esa nueva lista, los TemplateItems de la plantilla deben ser exactamente los de la nueva lista (sin ítems de la lista anterior).

**Valida: Requisitos 4.5**

---

### Propiedad 15: Eliminación en cascada de TemplateItems

*Para cualquier* QuoteTemplate con TemplateItems, después de eliminar la plantilla, ninguno de sus TemplateItems debe existir en la base de datos.

**Valida: Requisitos 4.7, 8.1**

---

### Propiedad 16: Round-trip de copia de TemplateItems a QuoteItems

*Para cualquier* QuoteTemplate con TemplateItems, crear una Quote a partir de esa plantilla y luego leer los QuoteItems de la Quote debe producir ítems con los mismos valores de `name`, `unitPrice`, `quantity`, `taxRate` y `discount` que los TemplateItems originales.

**Valida: Requisitos 5.2, 8.5**

---

### Propiedad 17: Totales calculados correctamente al crear Quote desde plantilla

*Para cualquier* QuoteTemplate con TemplateItems, la Quote creada a partir de la plantilla debe tener `subtotal`, `taxAmount` y `total` calculados correctamente según los valores de los QuoteItems copiados y el `taxRate` y `discount` de la plantilla.

**Valida: Requisitos 5.3**

---

### Propiedad 18: Precedencia del DTO sobre la plantilla

*Para cualquier* QuoteTemplate y cualquier DTO de creación de Quote que incluya campos que también están en la plantilla (currency, taxRate, discount, notes, terms), los valores del DTO deben prevalecer sobre los de la plantilla en la Quote creada.

**Valida: Requisitos 5.4**

---

### Propiedad 19: Independencia de QuoteItems al eliminar CatalogItem

*Para cualquier* QuoteItem cuyos datos fueron copiados de un CatalogItem, después de eliminar el CatalogItem, el QuoteItem debe seguir existiendo con los mismos valores que tenía antes de la eliminación.

**Valida: Requisitos 8.2**

---

### Propiedad 20: Independencia de Quotes al eliminar QuoteTemplate

*Para cualquier* Quote creada a partir de una QuoteTemplate, después de eliminar la QuoteTemplate, la Quote debe seguir existiendo con los mismos valores (incluyendo sus QuoteItems) que tenía antes de la eliminación.

**Valida: Requisitos 8.3**

---

## Manejo de Errores

| Escenario | Código HTTP | Mensaje |
|-----------|-------------|---------|
| CatalogItem no encontrado o no pertenece al usuario | 404 | `Catalog item not found` |
| QuoteTemplate no encontrada o no accesible | 404 | `Quote template not found` |
| Intento de modificar/eliminar plantilla del sistema | 403 | `Cannot modify system templates` |
| Quote de origen no encontrada al guardar como plantilla | 404 | `Quote not found` |
| `templateId` inválido al crear Quote | 404 | `Quote template not found` |
| Token JWT ausente o inválido | 401 | (estándar NestJS) |
| Validación de DTO fallida | 400 | (mensajes de class-validator) |

### Estrategia de manejo de errores en el frontend

- Todos los hooks de React Query exponen el estado de error (`isError`, `error`)
- Los componentes muestran mensajes de error descriptivos usando el patrón existente del proyecto
- Los errores 401 redirigen al login (manejado por el interceptor de `apiClient`)
- Los errores 403 muestran un mensaje indicando que la operación no está permitida en plantillas del sistema

---

## Estrategia de Testing

### Enfoque dual: tests unitarios + tests de propiedades

Los tests unitarios verifican ejemplos concretos, casos límite y condiciones de error. Los tests de propiedades verifican invariantes universales sobre rangos amplios de entradas generadas aleatoriamente. Ambos son complementarios y necesarios.

**Tests unitarios** (Jest + ts-jest, patrón existente del proyecto):
- Ejemplos concretos de creación, lectura, actualización y eliminación
- Casos de error (404, 403, 401)
- Integración entre módulos (ej. crear Quote desde QuoteTemplate)
- Comportamiento del frontend (renderizado de componentes, interacciones de UI)

**Tests de propiedades** (fast-check, ya instalado en el proyecto):
- Mínimo 100 iteraciones por propiedad
- Cada test referencia la propiedad del documento de diseño con el tag:
  `Feature: products-catalog-and-quote-templates, Property N: <texto>`

### Archivos de tests de propiedades

```
test/backend/src/catalog/
  catalog.isolation.pbt.spec.ts      // Propiedad 1
  catalog.roundtrip.pbt.spec.ts      // Propiedades 2, 7
  catalog.validation.pbt.spec.ts     // Propiedades 3, 4
  catalog.search.pbt.spec.ts         // Propiedad 5
  catalog.patch.pbt.spec.ts          // Propiedad 6

test/backend/src/templates/
  quote-templates.roundtrip.pbt.spec.ts   // Propiedades 9, 16
  quote-templates.validation.pbt.spec.ts  // Propiedades 10, 11
  quote-templates.list.pbt.spec.ts        // Propiedades 12, 13
  quote-templates.update.pbt.spec.ts      // Propiedad 14
  quote-templates.cascade.pbt.spec.ts     // Propiedad 15

test/backend/src/quotes/
  quotes.template-copy.pbt.spec.ts        // Propiedades 17, 18
  quotes.data-independence.pbt.spec.ts    // Propiedades 19, 20

test/frontend/src/components/catalog/
  CatalogSearch.prefill.pbt.test.tsx      // Propiedad 8
```

### Ejemplo de test de propiedad (Propiedad 16)

```typescript
// Feature: products-catalog-and-quote-templates, Property 16: Round-trip de copia de TemplateItems a QuoteItems
it('crear Quote desde QuoteTemplate copia los TemplateItems correctamente', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 255 }),
          unitPrice: fc.float({ min: 0, max: 10000 }),
          quantity: fc.float({ min: 0, max: 1000 }),
          taxRate: fc.float({ min: 0, max: 100 }),
          discount: fc.float({ min: 0, max: 1000 }),
        }),
        { minLength: 1, maxLength: 10 }
      ),
      async (templateItems) => {
        const template = await quoteTemplatesService.create(userId, {
          name: 'Test Template',
          items: templateItems.map((item, i) => ({ ...item, order: i + 1 })),
        });

        const quote = await quotesService.create(userId, {
          title: 'Test Quote',
          templateId: template.id,
        });

        const quoteItems = await quoteItemsService.findAll(userId, quote.id);

        expect(quoteItems).toHaveLength(templateItems.length);
        for (let i = 0; i < templateItems.length; i++) {
          expect(Number(quoteItems[i].unitPrice)).toBeCloseTo(templateItems[i].unitPrice, 2);
          expect(Number(quoteItems[i].quantity)).toBeCloseTo(templateItems[i].quantity, 2);
          expect(Number(quoteItems[i].taxRate)).toBeCloseTo(templateItems[i].taxRate, 2);
          expect(Number(quoteItems[i].discount)).toBeCloseTo(templateItems[i].discount, 2);
          expect(quoteItems[i].name).toBe(templateItems[i].name);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### Configuración de tests de propiedades

- Librería: **fast-check** (ya instalada en `test/backend/node_modules/fast-check`)
- Runner: **Jest** con **ts-jest** (configuración existente del proyecto)
- Iteraciones mínimas: **100 por propiedad**
- Cada test de propiedad debe incluir el tag de referencia al documento de diseño
