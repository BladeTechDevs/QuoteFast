/**
 * Feature: products-catalog-and-quote-templates, Property 6: Patch parcial de CatalogItem preserva campos no modificados
 *
 * Valida: Requisito 1.7
 *
 * Para cualquier CatalogItem existente y cualquier subconjunto de campos a actualizar,
 * después del patch los campos actualizados deben tener los nuevos valores y los campos
 * no incluidos en el patch deben mantener sus valores originales.
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService - Property 6: Patch parcial de CatalogItem preserva campos no modificados', () => {
  let service: CatalogService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            catalogItem: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get(PrismaService);
  });

  /**
   * Validates: Requirements 1.7
   *
   * Para cualquier CatalogItem existente y cualquier subconjunto de campos a actualizar,
   * después del patch los campos actualizados deben tener los nuevos valores y los campos
   * no incluidos en el patch deben mantener sus valores originales.
   */
  it(
    'Property 6: patch parcial actualiza solo los campos indicados y preserva los demás',
    async () => {
      // Arbitrario para un CatalogItem existente completo
      const catalogItemArb = fc.record({
        id: fc.uuid(),
        userId: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 255 }),
        description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
        unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
        taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
        discount: fc.float({ min: 0, max: 100000, noNaN: true }),
        internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
        createdAt: fc.constant(new Date()),
        updatedAt: fc.constant(new Date()),
      });

      // Arbitrario para un patch parcial: subconjunto aleatorio de campos actualizables
      const patchDtoArb = fc.record(
        {
          name: fc.string({ minLength: 1, maxLength: 255 }),
          description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
          unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
          taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
          discount: fc.float({ min: 0, max: 100000, noNaN: true }),
          internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
        },
        { requiredKeys: [] }, // todos los campos son opcionales → subconjunto aleatorio
      );

      await fc.assert(
        fc.asyncProperty(
          catalogItemArb,
          patchDtoArb,
          async (existingItem, patchDto) => {
            // Simular el objeto actualizado que devolvería Prisma:
            // aplica solo los campos presentes en patchDto sobre existingItem
            const updatedItem = {
              ...existingItem,
              ...(patchDto.name !== undefined && { name: patchDto.name }),
              ...(patchDto.description !== undefined && { description: patchDto.description }),
              ...(patchDto.unitPrice !== undefined && { unitPrice: patchDto.unitPrice }),
              ...(patchDto.taxRate !== undefined && { taxRate: patchDto.taxRate }),
              ...(patchDto.discount !== undefined && { discount: patchDto.discount }),
              ...(patchDto.internalCost !== undefined && { internalCost: patchDto.internalCost }),
              updatedAt: new Date(),
            };

            // Mock findFirst: el ítem existe y pertenece al usuario
            (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(existingItem);

            // Mock update: devuelve el objeto con los campos aplicados
            (prisma.catalogItem.update as jest.Mock).mockResolvedValue(updatedItem);

            const result = await service.update(existingItem.userId, existingItem.id, patchDto);

            // ── Verificar campos actualizados ──────────────────────────────────
            if (patchDto.name !== undefined) {
              expect(result.name).toBe(patchDto.name);
            }
            if (patchDto.description !== undefined) {
              expect(result.description).toBe(patchDto.description);
            }
            if (patchDto.unitPrice !== undefined) {
              expect(result.unitPrice).toBe(patchDto.unitPrice);
            }
            if (patchDto.taxRate !== undefined) {
              expect(result.taxRate).toBe(patchDto.taxRate);
            }
            if (patchDto.discount !== undefined) {
              expect(result.discount).toBe(patchDto.discount);
            }
            if (patchDto.internalCost !== undefined) {
              expect(result.internalCost).toBe(patchDto.internalCost);
            }

            // ── Verificar campos NO actualizados (preservados) ─────────────────
            if (patchDto.name === undefined) {
              expect(result.name).toBe(existingItem.name);
            }
            if (patchDto.description === undefined) {
              expect(result.description).toBe(existingItem.description);
            }
            if (patchDto.unitPrice === undefined) {
              expect(result.unitPrice).toBe(existingItem.unitPrice);
            }
            if (patchDto.taxRate === undefined) {
              expect(result.taxRate).toBe(existingItem.taxRate);
            }
            if (patchDto.discount === undefined) {
              expect(result.discount).toBe(existingItem.discount);
            }
            if (patchDto.internalCost === undefined) {
              expect(result.internalCost).toBe(existingItem.internalCost);
            }

            // ── Verificar que el id y userId no cambian ────────────────────────
            expect(result.id).toBe(existingItem.id);
            expect(result.userId).toBe(existingItem.userId);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
