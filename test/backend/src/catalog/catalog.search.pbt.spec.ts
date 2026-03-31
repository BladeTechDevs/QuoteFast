/**
 * Feature: products-catalog-and-quote-templates, Property 5: Filtrado de búsqueda en catálogo
 *
 * Valida: Requisito 1.6
 *
 * Para cualquier término de búsqueda y lista de CatalogItems del usuario, todos los
 * ítems retornados por la búsqueda deben contener el término (de forma insensible a
 * mayúsculas) en su `name` o `description`, y ningún ítem que no contenga el término
 * debe aparecer en los resultados.
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService - Property 5: Filtrado de búsqueda en catálogo', () => {
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

  it(
    /**
     * Validates: Requirements 1.6
     */
    'todos los ítems retornados contienen el término de búsqueda en name o description (case-insensitive), y ningún ítem sin el término aparece en los resultados',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generar un userId
          fc.uuid(),
          // Generar un término de búsqueda no vacío (al menos 1 carácter)
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          // Generar entre 0 y 10 ítems que SÍ contienen el término (en name o description)
          fc.array(
            fc.record({
              id: fc.uuid(),
              // El name contiene el término (en alguna variante de mayúsculas)
              name: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
              unitPrice: fc.float({ min: 0, max: 10000, noNaN: true }),
              taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
              discount: fc.float({ min: 0, max: 1000, noNaN: true }),
              internalCost: fc.float({ min: 0, max: 10000, noNaN: true }),
              createdAt: fc.constant(new Date()),
              updatedAt: fc.constant(new Date()),
            }),
            { minLength: 0, maxLength: 10 },
          ),
          // Generar entre 0 y 10 ítems que NO contienen el término
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
              unitPrice: fc.float({ min: 0, max: 10000, noNaN: true }),
              taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
              discount: fc.float({ min: 0, max: 1000, noNaN: true }),
              internalCost: fc.float({ min: 0, max: 10000, noNaN: true }),
              createdAt: fc.constant(new Date()),
              updatedAt: fc.constant(new Date()),
            }),
            { minLength: 0, maxLength: 10 },
          ),
          async (userId, searchTerm, matchingItems, nonMatchingItems) => {
            const searchLower = searchTerm.toLowerCase();

            // Construir ítems que SÍ contienen el término en name (insertar el término en el name)
            const matchingItemsWithTerm = matchingItems.map((item) => ({
              ...item,
              userId,
              // Asegurar que el name contiene el término de búsqueda
              name: item.name + searchTerm,
            }));

            // Construir ítems que NO contienen el término: filtrar cualquier coincidencia accidental
            const nonMatchingItemsFiltered = nonMatchingItems
              .map((item) => ({
                ...item,
                userId,
                // Asegurar que ni name ni description contienen el término
                name: item.name.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'X'),
                description:
                  item.description === null
                    ? null
                    : item.description.replace(
                        new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                        'X',
                      ),
              }))
              // Verificar que realmente no contienen el término tras el reemplazo
              .filter((item) => {
                const nameContains = item.name.toLowerCase().includes(searchLower);
                const descContains =
                  item.description !== null && item.description.toLowerCase().includes(searchLower);
                return !nameContains && !descContains;
              });

            const allItems = [...matchingItemsWithTerm, ...nonMatchingItemsFiltered];

            // El mock simula el filtrado de la BD: filtra por name o description case-insensitive
            (prisma.catalogItem.findMany as jest.Mock).mockImplementation(({ where }) => {
              let filtered = allItems.filter((item) => item.userId === where.userId);

              if (where.OR) {
                // Simular el filtrado OR de Prisma: name contains OR description contains (insensitive)
                filtered = filtered.filter((item) => {
                  const nameMatch = item.name.toLowerCase().includes(searchLower);
                  const descMatch =
                    item.description !== null &&
                    item.description !== undefined &&
                    item.description.toLowerCase().includes(searchLower);
                  return nameMatch || descMatch;
                });
              }

              return Promise.resolve(filtered);
            });

            (prisma.catalogItem.count as jest.Mock).mockImplementation(({ where }) => {
              let filtered = allItems.filter((item) => item.userId === where.userId);

              if (where.OR) {
                filtered = filtered.filter((item) => {
                  const nameMatch = item.name.toLowerCase().includes(searchLower);
                  const descMatch =
                    item.description !== null &&
                    item.description !== undefined &&
                    item.description.toLowerCase().includes(searchLower);
                  return nameMatch || descMatch;
                });
              }

              return Promise.resolve(filtered.length);
            });

            const result = await service.findAll(userId, { page: 1, limit: 100, search: searchTerm });

            // Propiedad 5a: todos los ítems retornados deben contener el término en name o description
            for (const item of result.data) {
              const nameContains = item.name.toLowerCase().includes(searchLower);
              const descContains =
                item.description !== null &&
                item.description !== undefined &&
                (item.description as string).toLowerCase().includes(searchLower);
              expect(nameContains || descContains).toBe(true);
            }

            // Propiedad 5b: ningún ítem que no contiene el término debe aparecer en los resultados
            const returnedIds = new Set(result.data.map((item) => item.id));
            for (const item of nonMatchingItemsFiltered) {
              expect(returnedIds.has(item.id)).toBe(false);
            }

            // Propiedad 5c: todos los ítems que sí contienen el término deben aparecer en los resultados
            for (const item of matchingItemsWithTerm) {
              expect(returnedIds.has(item.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
