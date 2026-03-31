/**
 * Feature: products-catalog-and-quote-templates, Property 3: Validación de name de CatalogItem
 * Feature: products-catalog-and-quote-templates, Property 4: Validación de unitPrice de CatalogItem
 *
 * Valida: Requisitos 1.3, 1.4
 */

import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';

/** Helper: valida un DTO y retorna true si hay errores en el campo dado */
async function hasErrorOn(field: string, dto: object): Promise<boolean> {
  const instance = plainToInstance(CreateCatalogItemDto, dto);
  const errors = await validate(instance);
  return errors.some((e) => e.property === field);
}

describe('CatalogItem DTO - Property 3 & 4: Validación de name y unitPrice', () => {
  // ─── Propiedad 3: Validación de `name` de CatalogItem ────────────────────

  /**
   * Validates: Requirements 1.3
   *
   * Para cualquier string, intentar crear un CatalogItem con ese string como
   * `name` debe ser rechazado si y solo si el string está vacío (o compuesto
   * solo de espacios) o supera 255 caracteres.
   */
  it(
    'Property 3: name es rechazado si y solo si está vacío/solo-espacios o supera 255 caracteres',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ maxLength: 300 }),
          async (name) => {
            const shouldBeRejected = name.trim().length === 0 || name.length > 255;

            const rejected = await hasErrorOn('name', {
              name,
              unitPrice: 10,
            });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ─── Propiedad 4: Validación de `unitPrice` de CatalogItem ───────────────

  /**
   * Validates: Requirements 1.4
   *
   * Para cualquier número, intentar crear un CatalogItem con ese número como
   * `unitPrice` debe ser rechazado si y solo si el número es menor que 0.
   */
  it(
    'Property 4: unitPrice es rechazado si y solo si es menor que 0',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ noNaN: true, min: -1e6, max: 1e6 }),
          async (unitPrice) => {
            const shouldBeRejected = unitPrice < 0;

            const rejected = await hasErrorOn('unitPrice', {
              name: 'Valid Name',
              unitPrice,
            });

            expect(rejected).toBe(shouldBeRejected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
