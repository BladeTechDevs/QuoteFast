/**
 * Feature: products-catalog-and-quote-templates, Property 10: Validación de name de QuoteTemplate
 * Feature: products-catalog-and-quote-templates, Property 11: Validación de TemplateItem
 *
 * Valida: Requisitos 3.2, 4.2, 8.4
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateQuoteTemplateDto } from './dto/create-quote-template.dto';
import { TemplateItemDto } from './dto/template-item.dto';

/** Helper: valida un DTO y retorna true si hay errores en el campo dado */
async function hasErrorOn(field: string, dto: object): Promise<boolean> {
  const instance = plainToInstance(CreateQuoteTemplateDto, dto);
  const errors = await validate(instance, { whitelist: true });
  return errors.some((e) => e.property === field);
}

/** Helper: valida el DTO completo y retorna true si hay algún error de validación */
async function hasAnyError(dto: object): Promise<boolean> {
  const instance = plainToInstance(CreateQuoteTemplateDto, dto);
  const errors = await validate(instance, { whitelist: true });
  return errors.length > 0;
}

/** Helper: valida un TemplateItemDto y retorna true si hay errores en el campo dado */
async function itemHasErrorOn(field: string, item: object): Promise<boolean> {
  const instance = plainToInstance(TemplateItemDto, item);
  const errors = await validate(instance);
  return errors.some((e) => e.property === field);
}

describe('QuoteTemplate DTO - Property 10 & 11: Validación de name y TemplateItem', () => {
  // ─── Propiedad 10: Validación de `name` de QuoteTemplate ─────────────────

  /**
   * Validates: Requirements 3.2
   *
   * Para cualquier string, intentar crear o guardar una QuoteTemplate con ese
   * string como `name` debe ser rechazado si y solo si el string está vacío o
   * supera 255 caracteres.
   */
  it(
    'Property 10: name es rechazado si y solo si está vacío o supera 255 caracteres',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ maxLength: 300 }),
          async (name) => {
            const shouldBeRejected = name.trim().length === 0 || name.length > 255;

            const rejected = await hasErrorOn('name', { name });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ─── Propiedad 11: Validación de TemplateItem (name y unitPrice/quantity) ─

  /**
   * Validates: Requirements 4.2, 8.4
   *
   * Para cualquier lista de TemplateItems, crear una QuoteTemplate con esa
   * lista debe ser rechazado si algún ítem tiene `name` vacío, `unitPrice` < 0
   * o `quantity` < 0.
   */
  it(
    'Property 11: TemplateItem con name vacío es rechazado',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ maxLength: 300 }),
          async (name) => {
            const shouldBeRejected = name.trim().length === 0 || name.length > 255;

            const rejected = await itemHasErrorOn('name', {
              name,
              unitPrice: 10,
              order: 1,
            });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 11: TemplateItem con unitPrice < 0 es rechazado',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ noNaN: true, min: -1e6, max: 1e6 }),
          async (unitPrice) => {
            const shouldBeRejected = unitPrice < 0;

            const rejected = await itemHasErrorOn('unitPrice', {
              name: 'Valid Item',
              unitPrice,
              order: 1,
            });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 11: TemplateItem con quantity < 0 es rechazado',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ noNaN: true, min: -1e6, max: 1e6 }),
          async (quantity) => {
            const shouldBeRejected = quantity < 0;

            const rejected = await itemHasErrorOn('quantity', {
              name: 'Valid Item',
              unitPrice: 10,
              quantity,
              order: 1,
            });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 11: QuoteTemplate con lista de ítems inválidos es rechazada',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ maxLength: 300 }),
              unitPrice: fc.float({ noNaN: true, min: -1e6, max: 1e6 }),
              quantity: fc.float({ noNaN: true, min: -1e6, max: 1e6 }),
              order: fc.nat(),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          async (items) => {
            const hasInvalidItem = items.some(
              (item) =>
                item.name.trim().length === 0 ||
                item.name.length > 255 ||
                item.unitPrice < 0 ||
                item.quantity < 0,
            );

            const rejected = await hasAnyError({
              name: 'Valid Template',
              items,
            });

            if (hasInvalidItem) {
              expect(rejected).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
