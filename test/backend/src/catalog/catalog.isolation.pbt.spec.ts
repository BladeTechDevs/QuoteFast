/**
 * Feature: products-catalog-and-quote-templates, Property 1: Aislamiento de datos del catálogo por usuario
 *
 * Valida: Requisitos 1.1, 1.5
 *
 * Para cualquier conjunto de usuarios con CatalogItems, la lista de CatalogItems
 * retornada para un usuario dado debe contener únicamente ítems cuyo `userId`
 * coincide con el usuario solicitante.
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService - Property 1: Aislamiento de datos del catálogo por usuario', () => {
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
    'findAll solo retorna ítems cuyo userId coincide con el usuario solicitante',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generar un userId solicitante (UUID-like string)
          fc.uuid(),
          // Generar entre 1 y 5 userIds adicionales distintos
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          // Generar entre 0 y 10 ítems para el usuario solicitante
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
          // Generar entre 0 y 10 ítems para otros usuarios
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
          async (requestingUserId, otherUserIds, ownItems, otherItems) => {
            // Asignar userId a los ítems propios
            const ownItemsWithUserId = ownItems.map((item) => ({
              ...item,
              userId: requestingUserId,
            }));

            // Asignar userIds de otros usuarios a los ítems ajenos
            const otherItemsWithUserId = otherItems.map((item, index) => ({
              ...item,
              userId: otherUserIds[index % otherUserIds.length],
            }));

            // El mock de PrismaService simula el filtrado por userId (como lo haría la BD)
            (prisma.catalogItem.findMany as jest.Mock).mockImplementation(({ where }) => {
              const allItems = [...ownItemsWithUserId, ...otherItemsWithUserId];
              return Promise.resolve(allItems.filter((item) => item.userId === where.userId));
            });

            (prisma.catalogItem.count as jest.Mock).mockImplementation(({ where }) => {
              const allItems = [...ownItemsWithUserId, ...otherItemsWithUserId];
              return Promise.resolve(
                allItems.filter((item) => item.userId === where.userId).length,
              );
            });

            const result = await service.findAll(requestingUserId, { page: 1, limit: 100 });

            // Propiedad: todos los ítems retornados deben pertenecer al usuario solicitante
            for (const item of result.data) {
              expect(item.userId).toBe(requestingUserId);
            }

            // Propiedad: no debe haber ítems de otros usuarios en el resultado
            const otherUserIdsSet = new Set(otherUserIds);
            for (const item of result.data) {
              expect(otherUserIdsSet.has(item.userId)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
