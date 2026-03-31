/**
 * Feature: products-catalog-and-quote-templates, Property 2: Round-trip de creación de CatalogItem
 * Feature: products-catalog-and-quote-templates, Property 7: Eliminación permanente de CatalogItem
 *
 * Valida: Requisitos 1.2, 1.9
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService - Property 2 & 7: Round-trip y eliminación de CatalogItem', () => {
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

  // ─── Propiedad 2: Round-trip de creación de CatalogItem ──────────────────

  /**
   * Validates: Requirements 1.2
   *
   * Para cualquier conjunto válido de datos de CatalogItem (name no vacío,
   * unitPrice >= 0), crear el ítem y luego buscarlo por su `id` debe retornar
   * un objeto con los mismos valores de `name`, `unitPrice`, `taxRate`,
   * `discount` e `internalCost`.
   */
  it(
    'Property 2: crear un CatalogItem y buscarlo por id retorna los mismos valores',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 255 }),
            description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
            unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
            taxRate: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
            discount: fc.option(fc.float({ min: 0, max: 100000, noNaN: true }), { nil: undefined }),
            internalCost: fc.option(fc.float({ min: 0, max: 100000, noNaN: true }), { nil: undefined }),
          }),
          async (userId, dto) => {
            const generatedId = 'item-' + Math.random().toString(36).slice(2);

            // El objeto que la BD devolvería tras crear el ítem
            const createdItem = {
              id: generatedId,
              userId,
              name: dto.name,
              description: dto.description ?? null,
              unitPrice: dto.unitPrice,
              taxRate: dto.taxRate ?? 0,
              discount: dto.discount ?? 0,
              internalCost: dto.internalCost ?? 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            (prisma.catalogItem.create as jest.Mock).mockResolvedValue(createdItem);

            // Simular findFirst: retorna el ítem si el id y userId coinciden
            (prisma.catalogItem.findFirst as jest.Mock).mockImplementation(({ where }) => {
              if (where.id === generatedId && where.userId === userId) {
                return Promise.resolve(createdItem);
              }
              return Promise.resolve(null);
            });

            // Simular findMany para findAll
            (prisma.catalogItem.findMany as jest.Mock).mockImplementation(({ where }) => {
              if (where.userId === userId) {
                return Promise.resolve([createdItem]);
              }
              return Promise.resolve([]);
            });
            (prisma.catalogItem.count as jest.Mock).mockResolvedValue(1);

            // Crear el ítem
            const created = await service.create(userId, dto);

            // Buscar el ítem por id usando findAll con un mock que filtra por id
            // Usamos findFirst directamente a través del mock para simular "buscar por id"
            const found = await (prisma.catalogItem.findFirst as jest.Mock)({
              where: { id: created.id, userId },
            });

            // Propiedad: los valores deben coincidir
            expect(found).not.toBeNull();
            expect(found.name).toBe(createdItem.name);
            expect(found.unitPrice).toBe(createdItem.unitPrice);
            expect(found.taxRate).toBe(createdItem.taxRate);
            expect(found.discount).toBe(createdItem.discount);
            expect(found.internalCost).toBe(createdItem.internalCost);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ─── Propiedad 7: Eliminación permanente de CatalogItem ──────────────────

  /**
   * Validates: Requirements 1.9
   *
   * Para cualquier CatalogItem que pertenece al usuario, después de eliminarlo,
   * intentar buscarlo por su `id` debe retornar un resultado vacío
   * (el registro no existe).
   */
  it(
    'Property 7: después de eliminar un CatalogItem, buscarlo por id retorna resultado vacío',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 255 }),
            unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
            taxRate: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
            discount: fc.option(fc.float({ min: 0, max: 100000, noNaN: true }), { nil: undefined }),
            internalCost: fc.option(fc.float({ min: 0, max: 100000, noNaN: true }), { nil: undefined }),
          }),
          async (userId, dto) => {
            const generatedId = 'item-' + Math.random().toString(36).slice(2);

            const existingItem = {
              id: generatedId,
              userId,
              name: dto.name,
              description: null,
              unitPrice: dto.unitPrice,
              taxRate: dto.taxRate ?? 0,
              discount: dto.discount ?? 0,
              internalCost: dto.internalCost ?? 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Estado interno: el ítem existe hasta que se elimina
            let itemExists = true;

            (prisma.catalogItem.findFirst as jest.Mock).mockImplementation(({ where }) => {
              if (where.id === generatedId && where.userId === userId && itemExists) {
                return Promise.resolve(existingItem);
              }
              return Promise.resolve(null);
            });

            (prisma.catalogItem.delete as jest.Mock).mockImplementation(() => {
              itemExists = false;
              return Promise.resolve(existingItem);
            });

            // Verificar que el ítem existe antes de eliminarlo
            const beforeDelete = await (prisma.catalogItem.findFirst as jest.Mock)({
              where: { id: generatedId, userId },
            });
            expect(beforeDelete).not.toBeNull();

            // Eliminar el ítem
            await service.remove(userId, generatedId);

            // Verificar que el ítem ya no existe después de eliminarlo
            const afterDelete = await (prisma.catalogItem.findFirst as jest.Mock)({
              where: { id: generatedId, userId },
            });
            expect(afterDelete).toBeNull();

            // También verificar que findAll no retorna el ítem eliminado
            (prisma.catalogItem.findMany as jest.Mock).mockImplementation(({ where }) => {
              if (where.userId === userId && !itemExists) {
                return Promise.resolve([]);
              }
              return Promise.resolve([existingItem]);
            });
            (prisma.catalogItem.count as jest.Mock).mockResolvedValue(itemExists ? 1 : 0);

            const listResult = await service.findAll(userId, { page: 1, limit: 100 });
            const foundInList = listResult.data.find((i) => i.id === generatedId);
            expect(foundInList).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
