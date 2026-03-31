/**
 * Feature: products-catalog-and-quote-templates, Property 14: Actualización de QuoteTemplate reemplaza TemplateItems
 *
 * Valida: Requisito 4.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteTemplatesService } from './quote-templates.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const templateItemArb = fc.record({
  id: fc.uuid(),
  templateId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.integer({ min: 0, max: 1000 }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

const newItemDtoArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.integer({ min: 0, max: 1000 }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTxMock() {
  return {
    quoteTemplate: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    templateItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
}

// ─── Property 14 ─────────────────────────────────────────────────────────────

describe('QuoteTemplatesService - Property 14: Actualización de QuoteTemplate reemplaza TemplateItems', () => {
  let service: QuoteTemplatesService;
  let prisma: jest.Mocked<PrismaService>;
  let txMock: ReturnType<typeof buildTxMock>;

  beforeEach(async () => {
    txMock = buildTxMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteTemplatesService,
        {
          provide: PrismaService,
          useValue: {
            quoteTemplate: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            templateItem: {},
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuoteTemplatesService>(QuoteTemplatesService);
    prisma = module.get(PrismaService);

    (prisma.$transaction as jest.Mock).mockImplementation(
      (cb: (tx: unknown) => unknown) => cb(txMock),
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * Para cualquier QuoteTemplate propia y cualquier nueva lista de TemplateItems,
   * después de actualizar la plantilla con esa nueva lista, los TemplateItems de
   * la plantilla deben ser exactamente los de la nueva lista (sin ítems de la
   * lista anterior).
   */
  it(
    'Property 14: update reemplaza completamente los TemplateItems con la nueva lista',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // templateId
          fc.array(templateItemArb, { minLength: 1, maxLength: 10 }), // old items
          fc.array(newItemDtoArb, { minLength: 0, maxLength: 10 }),   // new items dto
          async (userId, templateId, oldItems, newItemDtos) => {
            // Existing template with old items
            const existingTemplate = {
              id: templateId,
              userId,
              name: 'Plantilla Existente',
              currency: 'USD',
              taxRate: 0,
              discount: 0,
              notes: null,
              terms: null,
              isDefault: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // findFirst returns the existing (non-system) template
            (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);

            // Transaction mocks
            txMock.quoteTemplate.update.mockResolvedValue(existingTemplate);
            txMock.templateItem.deleteMany.mockResolvedValue({ count: oldItems.length });
            txMock.templateItem.createMany.mockResolvedValue({ count: newItemDtos.length });

            // Build the expected result: template with exactly the new items
            const newItemsAsStored = newItemDtos.map((item, idx) => ({
              id: `new-item-${idx}`,
              templateId,
              name: item.name,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice,
              discount: item.discount ?? 0,
              taxRate: item.taxRate ?? 0,
              internalCost: item.internalCost ?? 0,
              order: item.order,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            const updatedTemplate = {
              ...existingTemplate,
              items: newItemsAsStored,
            };

            txMock.quoteTemplate.findUnique.mockResolvedValue(updatedTemplate);

            // Execute update with new items list
            const result = await service.update(userId, templateId, {
              items: newItemDtos,
            });

            // ── Property 14 assertions ─────────────────────────────────────

            // The result must contain exactly the new items (not the old ones)
            expect(result!.items).toHaveLength(newItemDtos.length);

            // Old items must not appear in the result
            const oldItemIds = new Set(oldItems.map((i) => i.id));
            for (const item of result!.items) {
              expect(oldItemIds.has(item.id)).toBe(false);
            }

            // New items must match the dto values
            for (let i = 0; i < newItemDtos.length; i++) {
              const dto = newItemDtos[i];
              const stored = result!.items[i];
              expect(stored.name).toBe(dto.name);
              expect(Number(stored.unitPrice)).toBeCloseTo(Number(dto.unitPrice), 5);
              expect(stored.order).toBe(dto.order);
            }

            // deleteMany must have been called to remove old items
            expect(txMock.templateItem.deleteMany).toHaveBeenCalledWith({
              where: { templateId },
            });

            // createMany must have been called with the new items data
            if (newItemDtos.length > 0) {
              expect(txMock.templateItem.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  data: expect.arrayContaining(
                    newItemDtos.map((item) =>
                      expect.objectContaining({
                        templateId,
                        name: item.name,
                        unitPrice: item.unitPrice,
                        order: item.order,
                      }),
                    ),
                  ),
                }),
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 14 (lista vacía): update con lista vacía elimina todos los TemplateItems anteriores',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // templateId
          fc.array(templateItemArb, { minLength: 1, maxLength: 10 }), // old items (at least 1)
          async (userId, templateId, oldItems) => {
            const existingTemplate = {
              id: templateId,
              userId,
              name: 'Plantilla con ítems',
              currency: 'USD',
              taxRate: 0,
              discount: 0,
              notes: null,
              terms: null,
              isDefault: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);

            txMock.quoteTemplate.update.mockResolvedValue(existingTemplate);
            txMock.templateItem.deleteMany.mockResolvedValue({ count: oldItems.length });
            // createMany should NOT be called when new list is empty

            const updatedTemplate = { ...existingTemplate, items: [] };
            txMock.quoteTemplate.findUnique.mockResolvedValue(updatedTemplate);

            const result = await service.update(userId, templateId, { items: [] });

            // Result must have no items
            expect(result!.items).toHaveLength(0);

            // deleteMany must have been called
            expect(txMock.templateItem.deleteMany).toHaveBeenCalledWith({
              where: { templateId },
            });

            // createMany must NOT have been called (empty list)
            expect(txMock.templateItem.createMany).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
