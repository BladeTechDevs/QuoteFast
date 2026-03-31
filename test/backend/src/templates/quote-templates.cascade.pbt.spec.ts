/**
 * Feature: products-catalog-and-quote-templates, Property 15: Eliminación en cascada de TemplateItems
 *
 * Valida: Requisitos 4.7, 8.1
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

// ─── Property 15 ─────────────────────────────────────────────────────────────

describe('QuoteTemplatesService - Property 15: Eliminación en cascada de TemplateItems', () => {
  let service: QuoteTemplatesService;
  let prisma: jest.Mocked<PrismaService>;

  // Track deleted state to simulate cascade
  let deletedTemplateIds: Set<string>;
  let deletedItemIds: Set<string>;

  beforeEach(async () => {
    deletedTemplateIds = new Set();
    deletedItemIds = new Set();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteTemplatesService,
        {
          provide: PrismaService,
          useValue: {
            quoteTemplate: {
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            templateItem: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuoteTemplatesService>(QuoteTemplatesService);
    prisma = module.get(PrismaService);
  });

  /**
   * **Validates: Requirements 4.7, 8.1**
   *
   * Para cualquier QuoteTemplate con TemplateItems, después de eliminar la
   * plantilla, ninguno de sus TemplateItems debe existir en la base de datos.
   */
  it(
    'Property 15: eliminar QuoteTemplate elimina en cascada todos sus TemplateItems',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // templateId
          fc.array(templateItemArb, { minLength: 1, maxLength: 10 }), // items (at least 1)
          async (userId, templateId, items) => {
            // Reset state for each run
            deletedTemplateIds = new Set();
            deletedItemIds = new Set();

            // Assign consistent templateId to all items
            const templateItems = items.map((item) => ({ ...item, templateId }));

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

            // findFirst returns the existing (non-system) template
            (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);

            // delete simulates cascade: marks template and all its items as deleted
            (prisma.quoteTemplate.delete as jest.Mock).mockImplementation(
              ({ where }: { where: { id: string } }) => {
                deletedTemplateIds.add(where.id);
                // Cascade: mark all items of this template as deleted
                for (const item of templateItems) {
                  if (item.templateId === where.id) {
                    deletedItemIds.add(item.id);
                  }
                }
                return Promise.resolve(existingTemplate);
              },
            );

            // findMany simulates querying items after deletion (returns only non-deleted)
            (prisma.templateItem.findMany as jest.Mock).mockImplementation(
              ({ where }: { where: { templateId: string } }) => {
                if (deletedTemplateIds.has(where.templateId)) {
                  return Promise.resolve([]);
                }
                return Promise.resolve(
                  templateItems.filter((i) => i.templateId === where.templateId),
                );
              },
            );

            // Execute remove
            await service.remove(userId, templateId);

            // ── Property 15 assertions ─────────────────────────────────────

            // The template must have been deleted
            expect(deletedTemplateIds.has(templateId)).toBe(true);

            // All items of the template must have been cascade-deleted
            for (const item of templateItems) {
              expect(deletedItemIds.has(item.id)).toBe(true);
            }

            // Querying items after deletion must return empty
            const remainingItems = await prisma.templateItem.findMany({
              where: { templateId },
            });
            expect(remainingItems).toHaveLength(0);

            // delete must have been called exactly once with the correct id
            expect(prisma.quoteTemplate.delete).toHaveBeenCalledWith({
              where: { id: templateId },
            });
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 15 (403): eliminar plantilla del sistema no elimina nada',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // templateId
          fc.array(templateItemArb, { minLength: 1, maxLength: 5 }),
          async (userId, templateId, items) => {
            deletedTemplateIds = new Set();
            deletedItemIds = new Set();

            const systemTemplate = {
              id: templateId,
              userId: null,
              name: 'Plantilla del sistema',
              currency: 'USD',
              taxRate: 0,
              discount: 0,
              notes: null,
              terms: null,
              isDefault: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(systemTemplate);
            (prisma.quoteTemplate.delete as jest.Mock).mockImplementation(() => {
              deletedTemplateIds.add(templateId);
              return Promise.resolve(systemTemplate);
            });

            // remove must throw ForbiddenException for system templates
            await expect(service.remove(userId, templateId)).rejects.toThrow();

            // delete must NOT have been called
            expect(prisma.quoteTemplate.delete).not.toHaveBeenCalled();

            // No items must have been deleted
            expect(deletedItemIds.size).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
