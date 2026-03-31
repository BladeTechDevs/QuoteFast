/**
 * Feature: products-catalog-and-quote-templates, Property 9: Round-trip de guardar Quote como QuoteTemplate
 * Feature: products-catalog-and-quote-templates, Property 16: Round-trip de copia de TemplateItems a QuoteItems
 *
 * Valida: Requisitos 3.1, 3.3, 3.4, 5.2, 8.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteTemplatesService } from './quote-templates.service';
import { QuotesService } from '../quotes/quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Plan } from '@prisma/client';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const quoteItemArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.nat({ max: 100 }),
  total: fc.constant(0),
  quoteId: fc.uuid(),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

const quoteMetaArb = fc.record({
  currency: fc.constantFrom('USD', 'EUR', 'MXN', 'COP'),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  notes: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  terms: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
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
  order: fc.nat({ max: 100 }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTxMock() {
  return {
    quote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    quoteTemplate: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    quoteItem: {
      createMany: jest.fn(),
    },
    templateItem: {
      createMany: jest.fn(),
    },
  };
}

// ─── Property 9 ──────────────────────────────────────────────────────────────

describe(
  'QuotesService - Property 9: Round-trip de guardar Quote como QuoteTemplate',
  () => {
    let quotesService: QuotesService;
    let prisma: jest.Mocked<PrismaService>;
    let txMock: ReturnType<typeof buildTxMock>;

    beforeEach(async () => {
      txMock = buildTxMock();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          QuotesService,
          {
            provide: PrismaService,
            useValue: {
              quote: { findFirst: jest.fn() },
              quoteTemplate: {},
              templateItem: {},
              $transaction: jest.fn(),
            },
          },
          {
            provide: NotificationsService,
            useValue: { create: jest.fn() },
          },
        ],
      }).compile();

      quotesService = module.get<QuotesService>(QuotesService);
      prisma = module.get(PrismaService);

      (prisma.$transaction as jest.Mock).mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
    });

    /**
     * **Validates: Requirements 3.1, 3.3, 3.4**
     *
     * Para cualquier Quote con QuoteItems, guardarla como QuoteTemplate debe
     * producir una QuoteTemplate con los mismos valores de `currency`, `taxRate`,
     * `discount`, `notes` y `terms`, y con TemplateItems que tienen los mismos
     * valores de `name`, `description`, `quantity`, `unitPrice`, `discount`,
     * `taxRate`, `internalCost` y `order` que los QuoteItems originales.
     */
    it(
      'guardar Quote como QuoteTemplate preserva metadatos e ítems',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(),                                          // userId
            fc.uuid(),                                          // quoteId
            quoteMetaArb,                                       // quote metadata
            fc.array(quoteItemArb, { minLength: 1, maxLength: 10 }), // items
            fc.string({ minLength: 1, maxLength: 100 }),        // template name
            async (userId, quoteId, meta, items, templateName) => {
              const quoteWithItems = {
                id: quoteId,
                userId,
                title: 'Test Quote',
                currency: meta.currency,
                taxRate: meta.taxRate,
                discount: meta.discount,
                notes: meta.notes,
                terms: meta.terms,
                deletedAt: null,
                items: items.map((item) => ({ ...item, quoteId })),
              };

              const templateId = 'generated-template-id';

              // Mock: findFirst returns the quote with items
              (prisma.quote.findFirst as jest.Mock).mockResolvedValue(quoteWithItems);

              // Mock: transaction creates template then items
              txMock.quoteTemplate.create.mockResolvedValue({
                id: templateId,
                userId,
                name: templateName,
                currency: meta.currency,
                taxRate: meta.taxRate,
                discount: meta.discount,
                notes: meta.notes,
                terms: meta.terms,
                isDefault: false,
              });
              txMock.templateItem.createMany.mockResolvedValue({ count: items.length });

              // The final findUnique returns the template with items copied from the quote
              const expectedTemplateItems = quoteWithItems.items.map((item) => ({
                id: `ti-${item.id}`,
                templateId,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                internalCost: item.internalCost,
                order: item.order,
              }));

              txMock.quoteTemplate.findUnique.mockResolvedValue({
                id: templateId,
                userId,
                name: templateName,
                currency: meta.currency,
                taxRate: meta.taxRate,
                discount: meta.discount,
                notes: meta.notes,
                terms: meta.terms,
                isDefault: false,
                items: expectedTemplateItems,
              });

              const result = await quotesService.saveAsTemplate(userId, quoteId, {
                name: templateName,
              });

              // ── Property 9 assertions ──────────────────────────────────────

              // Metadata round-trip
              expect(result!.currency).toBe(meta.currency);
              expect(Number(result!.taxRate)).toBeCloseTo(meta.taxRate, 5);
              expect(Number(result!.discount)).toBeCloseTo(meta.discount, 5);
              expect(result!.notes).toBe(meta.notes);
              expect(result!.terms).toBe(meta.terms);

              // Template must be user-owned (not system)
              expect(result!.isDefault).toBe(false);
              expect(result!.userId).toBe(userId);

              // Items round-trip: same count
              expect(result!.items).toHaveLength(items.length);

              // Items round-trip: same field values
              for (let i = 0; i < items.length; i++) {
                const originalItem = quoteWithItems.items[i];
                const templateItem = result!.items[i];

                expect(templateItem.name).toBe(originalItem.name);
                expect(templateItem.description).toBe(originalItem.description);
                expect(Number(templateItem.quantity)).toBeCloseTo(
                  Number(originalItem.quantity),
                  5,
                );
                expect(Number(templateItem.unitPrice)).toBeCloseTo(
                  Number(originalItem.unitPrice),
                  5,
                );
                expect(Number(templateItem.discount)).toBeCloseTo(
                  Number(originalItem.discount),
                  5,
                );
                expect(Number(templateItem.taxRate)).toBeCloseTo(
                  Number(originalItem.taxRate),
                  5,
                );
                expect(Number(templateItem.internalCost)).toBeCloseTo(
                  Number(originalItem.internalCost),
                  5,
                );
                expect(templateItem.order).toBe(originalItem.order);
              }

              // Verify the transaction created the template with correct metadata
              expect(txMock.quoteTemplate.create).toHaveBeenCalledWith(
                expect.objectContaining({
                  data: expect.objectContaining({
                    userId,
                    name: templateName,
                    currency: meta.currency,
                    isDefault: false,
                  }),
                }),
              );

              // Verify items were created with correct data
              expect(txMock.templateItem.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  data: expect.arrayContaining(
                    items.map((item) =>
                      expect.objectContaining({
                        name: item.name,
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        order: item.order,
                      }),
                    ),
                  ),
                }),
              );
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);

// ─── Property 16 ─────────────────────────────────────────────────────────────

describe(
  'QuotesService - Property 16: Round-trip de copia de TemplateItems a QuoteItems',
  () => {
    let quotesService: QuotesService;
    let prisma: jest.Mocked<PrismaService>;
    let txMock: ReturnType<typeof buildTxMock>;

    beforeEach(async () => {
      txMock = buildTxMock();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          QuotesService,
          {
            provide: PrismaService,
            useValue: {
              user: { findUnique: jest.fn() },
              quote: {
                create: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
                findUnique: jest.fn(),
              },
              quoteTemplate: { findFirst: jest.fn() },
              template: { findFirst: jest.fn() },
              quoteItem: { createMany: jest.fn() },
              $transaction: jest.fn(),
            },
          },
          {
            provide: NotificationsService,
            useValue: { create: jest.fn() },
          },
        ],
      }).compile();

      quotesService = module.get<QuotesService>(QuotesService);
      prisma = module.get(PrismaService);

      (prisma.$transaction as jest.Mock).mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
    });

    /**
     * **Validates: Requirements 5.2, 8.5**
     *
     * Para cualquier QuoteTemplate con TemplateItems, crear una Quote a partir
     * de esa plantilla y luego leer los QuoteItems de la Quote debe producir
     * ítems con los mismos valores de `name`, `unitPrice`, `quantity`, `taxRate`
     * y `discount` que los TemplateItems originales.
     */
    it(
      'crear Quote desde QuoteTemplate copia los TemplateItems correctamente',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(),                                                // userId
            fc.uuid(),                                                // templateId
            quoteMetaArb,                                             // template metadata
            fc.array(templateItemArb, { minLength: 1, maxLength: 10 }), // template items
            async (userId, templateId, meta, templateItems) => {
              const quoteId = 'generated-quote-id';

              // Assign consistent templateId to items
              const items = templateItems.map((item) => ({
                ...item,
                templateId,
              }));

              const mockTemplate = {
                id: templateId,
                userId,
                name: 'Test Template',
                currency: meta.currency,
                taxRate: meta.taxRate,
                discount: meta.discount,
                notes: meta.notes,
                terms: meta.terms,
                isDefault: false,
                items,
              };

              // User is on PRO plan (no free plan limit)
              (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                id: userId,
                plan: Plan.PRO,
              });

              // Template lookup returns our mock template
              (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

              // Transaction mocks
              const createdQuote = {
                id: quoteId,
                userId,
                title: 'Test Quote',
                currency: meta.currency,
                taxRate: meta.taxRate,
                discount: meta.discount,
                notes: meta.notes,
                terms: meta.terms,
                status: 'DRAFT',
                quoteTemplateId: templateId,
              };

              txMock.quote.create.mockResolvedValue(createdQuote);
              txMock.quoteItem.createMany.mockResolvedValue({ count: items.length });
              txMock.quote.update.mockResolvedValue(createdQuote);

              // The final findUnique returns the quote with copied items
              const copiedQuoteItems = items.map((item) => ({
                id: `qi-${item.id}`,
                quoteId,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                internalCost: item.internalCost,
                order: item.order,
                total: 0,
              }));

              txMock.quote.findUnique.mockResolvedValue({
                ...createdQuote,
                items: copiedQuoteItems,
                client: null,
              });

              const result = await quotesService.create(userId, {
                title: 'Test Quote',
                templateId,
              });

              // ── Property 16 assertions ─────────────────────────────────────

              expect(result!.items).toHaveLength(items.length);

              for (let i = 0; i < items.length; i++) {
                const originalItem = items[i];
                const quoteItem = result!.items[i];

                expect(quoteItem.name).toBe(originalItem.name);
                expect(Number(quoteItem.unitPrice)).toBeCloseTo(
                  Number(originalItem.unitPrice),
                  5,
                );
                expect(Number(quoteItem.quantity)).toBeCloseTo(
                  Number(originalItem.quantity),
                  5,
                );
                expect(Number(quoteItem.taxRate)).toBeCloseTo(
                  Number(originalItem.taxRate),
                  5,
                );
                expect(Number(quoteItem.discount)).toBeCloseTo(
                  Number(originalItem.discount),
                  5,
                );
              }

              // Verify items were created via createMany with correct data
              expect(txMock.quoteItem.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                  data: expect.arrayContaining(
                    items.map((item) =>
                      expect.objectContaining({
                        name: item.name,
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        taxRate: item.taxRate,
                        discount: item.discount,
                        quoteId,
                      }),
                    ),
                  ),
                }),
              );
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);
