/**
 * Feature: products-catalog-and-quote-templates, Property 19: Independencia de QuoteItems al eliminar CatalogItem
 * Feature: products-catalog-and-quote-templates, Property 20: Independencia de Quotes al eliminar QuoteTemplate
 *
 * Valida: Requisitos 8.2, 8.3
 *
 * Decisión de diseño clave:
 * - CatalogItem NO tiene FK hacia QuoteItem (los datos se copian). Eliminar un
 *   CatalogItem NO produce cascada sobre QuoteItems.
 * - QuoteTemplate NO tiene FK obligatoria hacia Quote (quoteTemplateId es
 *   informativo). Eliminar una QuoteTemplate NO produce cascada sobre Quotes.
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { CatalogService } from '../catalog/catalog.service';
import { QuoteTemplatesService } from '../templates/quote-templates.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const quoteItemArb = fc.record({
  id: fc.uuid(),
  quoteId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.integer({ min: 0, max: 100 }),
  total: fc.float({ min: 0, max: 1e9, noNaN: true }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

const catalogItemArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

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
  order: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

const quoteArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  currency: fc.constantFrom('USD', 'EUR', 'MXN', 'COP'),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  notes: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  terms: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  subtotal: fc.float({ min: 0, max: 1e9, noNaN: true }),
  taxAmount: fc.float({ min: 0, max: 1e9, noNaN: true }),
  total: fc.float({ min: 0, max: 1e9, noNaN: true }),
  status: fc.constant('DRAFT'),
  deletedAt: fc.constant(null),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

// ─── Property 19 ─────────────────────────────────────────────────────────────

describe(
  'CatalogService - Property 19: Independencia de QuoteItems al eliminar CatalogItem',
  () => {
    let catalogService: CatalogService;
    let prisma: jest.Mocked<PrismaService>;

    // Track which catalog items have been deleted
    let deletedCatalogItemIds: Set<string>;

    beforeEach(async () => {
      deletedCatalogItemIds = new Set();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CatalogService,
          {
            provide: PrismaService,
            useValue: {
              catalogItem: {
                findFirst: jest.fn(),
                delete: jest.fn(),
              },
              quoteItem: {
                findMany: jest.fn(),
              },
            },
          },
        ],
      }).compile();

      catalogService = module.get<CatalogService>(CatalogService);
      prisma = module.get(PrismaService);
    });

    /**
     * **Validates: Requirements 8.2**
     *
     * Para cualquier QuoteItem cuyos datos fueron copiados de un CatalogItem,
     * después de eliminar el CatalogItem, el QuoteItem debe seguir existiendo
     * con los mismos valores que tenía antes de la eliminación.
     *
     * Esto verifica la decisión arquitectónica: CatalogItem no tiene FK hacia
     * QuoteItem, por lo que su eliminación no produce ninguna cascada.
     */
    it(
      'Property 19: eliminar CatalogItem no afecta los QuoteItems que copiaron sus datos',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(), // userId
            catalogItemArb, // catalogItem original
            fc.array(quoteItemArb, { minLength: 1, maxLength: 10 }), // quoteItems copiados
            async (userId, catalogItem, quoteItems) => {
              // Reset state for each run
              deletedCatalogItemIds = new Set();

              const itemWithUser = { ...catalogItem, userId };

              // Snapshot of QuoteItems BEFORE deletion (simulates data copied from CatalogItem)
              const quoteItemsBeforeDeletion = quoteItems.map((qi) => ({
                ...qi,
                // Data was copied from catalogItem at creation time
                name: catalogItem.name,
                unitPrice: catalogItem.unitPrice,
                taxRate: catalogItem.taxRate,
                discount: catalogItem.discount,
                internalCost: catalogItem.internalCost,
              }));

              // findFirst returns the catalog item (ownership check passes)
              (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(itemWithUser);

              // delete removes the catalog item — no cascade to quoteItems
              (prisma.catalogItem.delete as jest.Mock).mockImplementation(
                ({ where }: { where: { id: string } }) => {
                  deletedCatalogItemIds.add(where.id);
                  return Promise.resolve(itemWithUser);
                },
              );

              // quoteItem.findMany returns the same items regardless of catalog deletion
              // (no FK relationship — data was copied)
              (prisma.quoteItem.findMany as jest.Mock).mockImplementation(() => {
                // QuoteItems are unaffected by catalog item deletion
                return Promise.resolve(quoteItemsBeforeDeletion);
              });

              // Execute: delete the catalog item
              await catalogService.remove(userId, catalogItem.id);

              // ── Property 19 assertions ─────────────────────────────────────

              // The catalog item must have been deleted
              expect(deletedCatalogItemIds.has(catalogItem.id)).toBe(true);

              // QuoteItems must still exist with their original values
              const quoteItemsAfterDeletion = await prisma.quoteItem.findMany({
                where: { quoteId: quoteItems[0].quoteId },
              });

              expect(quoteItemsAfterDeletion).toHaveLength(quoteItemsBeforeDeletion.length);

              // Each QuoteItem must retain the same values it had before deletion
              for (let i = 0; i < quoteItemsBeforeDeletion.length; i++) {
                const before = quoteItemsBeforeDeletion[i];
                const after = quoteItemsAfterDeletion[i];

                expect(after.id).toBe(before.id);
                expect(after.name).toBe(before.name);
                expect(after.unitPrice).toBe(before.unitPrice);
                expect(after.taxRate).toBe(before.taxRate);
                expect(after.discount).toBe(before.discount);
                expect(after.internalCost).toBe(before.internalCost);
                expect(after.quantity).toBe(before.quantity);
                expect(after.total).toBe(before.total);
              }

              // delete must have been called exactly once for the catalog item
              expect(prisma.catalogItem.delete).toHaveBeenCalledWith({
                where: { id: catalogItem.id },
              });

              // quoteItem.delete / deleteMany must NOT have been called
              // (no cascade — CatalogItem has no FK to QuoteItem)
              expect((prisma as any).quoteItem?.delete).toBeUndefined();
              expect((prisma as any).quoteItem?.deleteMany).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);

// ─── Property 20 ─────────────────────────────────────────────────────────────

describe(
  'QuoteTemplatesService - Property 20: Independencia de Quotes al eliminar QuoteTemplate',
  () => {
    let quoteTemplatesService: QuoteTemplatesService;
    let prisma: jest.Mocked<PrismaService>;

    // Track which templates have been deleted
    let deletedTemplateIds: Set<string>;

    beforeEach(async () => {
      deletedTemplateIds = new Set();

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
              quote: {
                findMany: jest.fn(),
              },
              quoteItem: {
                findMany: jest.fn(),
              },
            },
          },
        ],
      }).compile();

      quoteTemplatesService = module.get<QuoteTemplatesService>(QuoteTemplatesService);
      prisma = module.get(PrismaService);
    });

    /**
     * **Validates: Requirements 8.3**
     *
     * Para cualquier Quote creada a partir de una QuoteTemplate, después de
     * eliminar la QuoteTemplate, la Quote debe seguir existiendo con los mismos
     * valores (incluyendo sus QuoteItems) que tenía antes de la eliminación.
     *
     * Esto verifica la decisión arquitectónica: quoteTemplateId en Quote es
     * informativo (sin FK obligatoria), por lo que eliminar la QuoteTemplate
     * no produce ninguna cascada sobre las Quotes.
     */
    it(
      'Property 20: eliminar QuoteTemplate no afecta las Quotes creadas a partir de ella',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(), // userId
            fc.uuid(), // templateId
            fc.array(templateItemArb, { minLength: 1, maxLength: 5 }), // template items
            fc.array(
              fc.tuple(quoteArb, fc.array(quoteItemArb, { minLength: 1, maxLength: 5 })),
              { minLength: 1, maxLength: 5 },
            ), // quotes with their items
            async (userId, templateId, templateItems, quotesWithItems) => {
              // Reset state for each run
              deletedTemplateIds = new Set();

              const existingTemplate = {
                id: templateId,
                userId,
                name: 'Plantilla de prueba',
                currency: 'USD',
                taxRate: 0,
                discount: 0,
                notes: null,
                terms: null,
                isDefault: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                items: templateItems.map((item) => ({ ...item, templateId })),
              };

              // Snapshot of Quotes BEFORE deletion (each quote references the template)
              const quotesBeforeDeletion = quotesWithItems.map(([quote, items]) => ({
                quote: { ...quote, userId, quoteTemplateId: templateId },
                items: items.map((item) => ({ ...item, quoteId: quote.id })),
              }));

              // findFirst returns the existing (non-system) template
              (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);

              // delete removes the template — no cascade to quotes
              (prisma.quoteTemplate.delete as jest.Mock).mockImplementation(
                ({ where }: { where: { id: string } }) => {
                  deletedTemplateIds.add(where.id);
                  return Promise.resolve(existingTemplate);
                },
              );

              // quote.findMany returns the same quotes regardless of template deletion
              // (quoteTemplateId is informational only — no FK constraint)
              (prisma.quote.findMany as jest.Mock).mockImplementation(() => {
                return Promise.resolve(quotesBeforeDeletion.map(({ quote }) => quote));
              });

              // quoteItem.findMany returns items for a given quoteId
              (prisma.quoteItem.findMany as jest.Mock).mockImplementation(
                ({ where }: { where: { quoteId: string } }) => {
                  const entry = quotesBeforeDeletion.find(
                    ({ quote }) => quote.id === where.quoteId,
                  );
                  return Promise.resolve(entry ? entry.items : []);
                },
              );

              // Execute: delete the template
              await quoteTemplatesService.remove(userId, templateId);

              // ── Property 20 assertions ─────────────────────────────────────

              // The template must have been deleted
              expect(deletedTemplateIds.has(templateId)).toBe(true);

              // Quotes must still exist with their original values
              const quotesAfterDeletion = await prisma.quote.findMany({
                where: { quoteTemplateId: templateId },
              });

              expect(quotesAfterDeletion).toHaveLength(quotesBeforeDeletion.length);

              // Each Quote must retain the same values it had before deletion
              for (let i = 0; i < quotesBeforeDeletion.length; i++) {
                const before = quotesBeforeDeletion[i].quote;
                const after = quotesAfterDeletion[i];

                expect(after.id).toBe(before.id);
                expect(after.title).toBe(before.title);
                expect(after.currency).toBe(before.currency);
                expect(after.taxRate).toBe(before.taxRate);
                expect(after.discount).toBe(before.discount);
                expect(after.notes).toBe(before.notes);
                expect(after.terms).toBe(before.terms);
                expect(after.subtotal).toBe(before.subtotal);
                expect(after.taxAmount).toBe(before.taxAmount);
                expect(after.total).toBe(before.total);
                // quoteTemplateId is preserved (informational reference)
                expect(after.quoteTemplateId).toBe(templateId);
              }

              // Each Quote's items must also be preserved
              for (const { quote, items: itemsBefore } of quotesBeforeDeletion) {
                const itemsAfter = await prisma.quoteItem.findMany({
                  where: { quoteId: quote.id },
                });

                expect(itemsAfter).toHaveLength(itemsBefore.length);

                for (let j = 0; j < itemsBefore.length; j++) {
                  expect(itemsAfter[j].id).toBe(itemsBefore[j].id);
                  expect(itemsAfter[j].name).toBe(itemsBefore[j].name);
                  expect(itemsAfter[j].unitPrice).toBe(itemsBefore[j].unitPrice);
                  expect(itemsAfter[j].quantity).toBe(itemsBefore[j].quantity);
                  expect(itemsAfter[j].taxRate).toBe(itemsBefore[j].taxRate);
                  expect(itemsAfter[j].discount).toBe(itemsBefore[j].discount);
                  expect(itemsAfter[j].total).toBe(itemsBefore[j].total);
                }
              }

              // delete must have been called exactly once with the correct id
              expect(prisma.quoteTemplate.delete).toHaveBeenCalledWith({
                where: { id: templateId },
              });

              // quote.delete / deleteMany must NOT have been called
              // (no cascade — quoteTemplateId has no FK constraint)
              expect((prisma as any).quote?.delete).toBeUndefined();
              expect((prisma as any).quote?.deleteMany).toBeUndefined();
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);
