/**
 * Feature: products-catalog-and-quote-templates, Property 17: Totales calculados correctamente al crear Quote desde plantilla
 * Feature: products-catalog-and-quote-templates, Property 18: Precedencia del DTO sobre la plantilla
 *
 * Valida: Requisitos 5.3, 5.4
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Plan } from '@prisma/client';
import {
  calculateItemTotal,
  calculateQuoteTotals,
} from './utils/calculate-totals';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const templateItemArb = fc.record({
  id: fc.uuid(),
  templateId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 1000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.nat({ max: 100 }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

const templateMetaArb = fc.record({
  currency: fc.constantFrom('USD', 'EUR', 'MXN', 'COP'),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 1000, noNaN: true }),
  notes: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  terms: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
});

// DTO metadata uses non-null notes/terms so they actually override the template
// (the service uses `??` so null DTO values fall through to the template value)
const dtoMetaArb = fc.record({
  currency: fc.constantFrom('USD', 'EUR', 'MXN', 'COP'),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 1000, noNaN: true }),
  notes: fc.string({ minLength: 1, maxLength: 500 }),
  terms: fc.string({ minLength: 1, maxLength: 500 }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTxMock() {
  return {
    quote: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    quoteItem: {
      createMany: jest.fn(),
    },
  };
}

function clearTxMock(txMock: ReturnType<typeof buildTxMock>) {
  txMock.quote.create.mockClear();
  txMock.quote.update.mockClear();
  txMock.quote.findUnique.mockClear();
  txMock.quoteItem.createMany.mockClear();
}

// ─── Property 17 ─────────────────────────────────────────────────────────────

describe(
  'QuotesService - Property 17: Totales calculados correctamente al crear Quote desde plantilla',
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
     * **Validates: Requirements 5.3**
     *
     * Para cualquier QuoteTemplate con TemplateItems, la Quote creada a partir
     * de la plantilla debe tener `subtotal`, `taxAmount` y `total` calculados
     * correctamente según los valores de los QuoteItems copiados y el `taxRate`
     * y `discount` de la plantilla.
     */
    it(
      'la Quote creada desde plantilla tiene subtotal, taxAmount y total correctamente calculados',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(),
            fc.uuid(),
            templateMetaArb,
            fc.array(templateItemArb, { minLength: 1, maxLength: 10 }),
            async (userId, templateId, meta, templateItems) => {
              // Clear mocks between iterations
              clearTxMock(txMock);
              (prisma.user.findUnique as jest.Mock).mockClear();
              (prisma.quoteTemplate.findFirst as jest.Mock).mockClear();

              const quoteId = 'generated-quote-id';
              const items = templateItems.map((item) => ({ ...item, templateId }));

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

              (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                id: userId,
                plan: Plan.PRO,
              });
              (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

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

              // Calculate expected totals using the same utility the service uses
              const expectedTotals = calculateQuoteTotals(
                items.map((item) => ({
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                  discount: Number(item.discount),
                  taxRate: Number(item.taxRate),
                })),
                meta.taxRate,
                meta.discount,
              );

              const quoteWithTotals = {
                ...createdQuote,
                subtotal: expectedTotals.subtotal,
                taxAmount: expectedTotals.taxAmount,
                total: expectedTotals.total,
              };

              txMock.quote.update.mockResolvedValue(quoteWithTotals);
              txMock.quote.findUnique.mockResolvedValue({
                ...quoteWithTotals,
                items: items.map((item) => ({
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
                  total: calculateItemTotal({
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    discount: Number(item.discount),
                    taxRate: Number(item.taxRate),
                  }),
                })),
                client: null,
              });

              await quotesService.create(userId, {
                title: 'Test Quote',
                templateId,
              });

              // ── Property 17 assertions ─────────────────────────────────────

              // Verify the service called quote.update with the correctly calculated totals
              expect(txMock.quote.update).toHaveBeenCalledTimes(1);
              const updateCall = (txMock.quote.update as jest.Mock).mock.calls[0][0];
              expect(updateCall.data.subtotal).toBeCloseTo(expectedTotals.subtotal, 4);
              expect(updateCall.data.taxAmount).toBeCloseTo(expectedTotals.taxAmount, 4);
              expect(updateCall.data.total).toBeCloseTo(expectedTotals.total, 4);

              // Verify each QuoteItem total was calculated correctly
              expect(txMock.quoteItem.createMany).toHaveBeenCalledTimes(1);
              const createManyCall = (txMock.quoteItem.createMany as jest.Mock).mock.calls[0][0];
              for (const item of items) {
                const expectedItemTotal = calculateItemTotal({
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                  discount: Number(item.discount),
                  taxRate: Number(item.taxRate),
                });
                const createdItem = createManyCall.data.find(
                  (d: any) => d.name === item.name && d.order === item.order,
                );
                expect(createdItem).toBeDefined();
                expect(createdItem.total).toBeCloseTo(expectedItemTotal, 4);
              }
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);

// ─── Property 18 ─────────────────────────────────────────────────────────────

describe(
  'QuotesService - Property 18: Precedencia del DTO sobre la plantilla',
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
     * **Validates: Requirements 5.4**
     *
     * Para cualquier QuoteTemplate y cualquier DTO de creación de Quote que
     * incluya campos que también están en la plantilla (currency, taxRate,
     * discount, notes, terms), los valores del DTO deben prevalecer sobre los
     * de la plantilla en la Quote creada.
     */
    it(
      'los valores del DTO tienen precedencia sobre los valores de la plantilla',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid(),
            fc.uuid(),
            templateMetaArb,
            dtoMetaArb,
            fc.array(templateItemArb, { minLength: 1, maxLength: 5 }),
            // Subset of fields to override via DTO (at least one)
            fc.subarray(
              ['currency', 'taxRate', 'discount', 'notes', 'terms'] as const,
              { minLength: 1 },
            ),
            async (userId, templateId, templateMeta, dtoMeta, templateItems, overrideFields) => {
              // Clear mocks between iterations
              clearTxMock(txMock);
              (prisma.user.findUnique as jest.Mock).mockClear();
              (prisma.quoteTemplate.findFirst as jest.Mock).mockClear();

              const quoteId = 'generated-quote-id';
              const items = templateItems.map((item) => ({ ...item, templateId }));

              const mockTemplate = {
                id: templateId,
                userId,
                name: 'Test Template',
                currency: templateMeta.currency,
                taxRate: templateMeta.taxRate,
                discount: templateMeta.discount,
                notes: templateMeta.notes,
                terms: templateMeta.terms,
                isDefault: false,
                items,
              };

              (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                id: userId,
                plan: Plan.PRO,
              });
              (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

              // Build DTO with only the overridden fields
              const dtoOverrides: Record<string, any> = {};
              for (const field of overrideFields) {
                dtoOverrides[field] = dtoMeta[field];
              }

              // Expected resolved values: DTO wins for overridden fields, template wins for the rest
              const expectedCurrency = overrideFields.includes('currency')
                ? dtoMeta.currency
                : templateMeta.currency;
              const expectedTaxRate = overrideFields.includes('taxRate')
                ? dtoMeta.taxRate
                : templateMeta.taxRate;
              const expectedDiscount = overrideFields.includes('discount')
                ? dtoMeta.discount
                : templateMeta.discount;
              const expectedNotes = overrideFields.includes('notes')
                ? dtoMeta.notes
                : templateMeta.notes;
              const expectedTerms = overrideFields.includes('terms')
                ? dtoMeta.terms
                : templateMeta.terms;

              const createdQuote = {
                id: quoteId,
                userId,
                title: 'Test Quote',
                currency: expectedCurrency,
                taxRate: expectedTaxRate,
                discount: expectedDiscount,
                notes: expectedNotes,
                terms: expectedTerms,
                status: 'DRAFT',
                quoteTemplateId: templateId,
              };

              txMock.quote.create.mockResolvedValue(createdQuote);
              txMock.quoteItem.createMany.mockResolvedValue({ count: items.length });
              txMock.quote.update.mockResolvedValue(createdQuote);
              txMock.quote.findUnique.mockResolvedValue({
                ...createdQuote,
                subtotal: 0,
                taxAmount: 0,
                total: 0,
                items: [],
                client: null,
              });

              await quotesService.create(userId, {
                title: 'Test Quote',
                templateId,
                ...dtoOverrides,
              });

              // ── Property 18 assertions ─────────────────────────────────────

              // Verify the quote was created with the correct resolved values
              expect(txMock.quote.create).toHaveBeenCalledTimes(1);
              const createCall = (txMock.quote.create as jest.Mock).mock.calls[0][0];

              // DTO-overridden fields must match DTO values
              for (const field of overrideFields) {
                if (field === 'currency') {
                  expect(createCall.data.currency).toBe(dtoMeta.currency);
                } else if (field === 'taxRate') {
                  expect(createCall.data.taxRate).toBeCloseTo(dtoMeta.taxRate, 4);
                } else if (field === 'discount') {
                  expect(createCall.data.discount).toBeCloseTo(dtoMeta.discount, 4);
                } else if (field === 'notes') {
                  expect(createCall.data.notes).toBe(dtoMeta.notes);
                } else if (field === 'terms') {
                  expect(createCall.data.terms).toBe(dtoMeta.terms);
                }
              }

              // Non-overridden fields must match template values
              const nonOverriddenFields = (
                ['currency', 'taxRate', 'discount', 'notes', 'terms'] as const
              ).filter((f) => !overrideFields.includes(f));

              for (const field of nonOverriddenFields) {
                if (field === 'currency') {
                  expect(createCall.data.currency).toBe(templateMeta.currency);
                } else if (field === 'taxRate') {
                  expect(createCall.data.taxRate).toBeCloseTo(templateMeta.taxRate, 4);
                } else if (field === 'discount') {
                  expect(createCall.data.discount).toBeCloseTo(templateMeta.discount, 4);
                } else if (field === 'notes') {
                  expect(createCall.data.notes).toBe(templateMeta.notes);
                } else if (field === 'terms') {
                  expect(createCall.data.terms).toBe(templateMeta.terms);
                }
              }
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  },
);
