import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteStatus } from '@prisma/client';
import { QuoteItemsService } from './quote-items.service';
import { PrismaService } from '../prisma/prisma.service';
import { calculateQuoteTotals } from '../quotes/utils/calculate-totals';

/**
 * Feature: saas-quote-platform, Property 11: Consistencia de totales tras modificación de ítems
 *
 * Validates: Requirement 3.6
 *
 * After adding, editing, or deleting items from a quote, the subtotal,
 * taxAmount, and total stored in the DB must match the values returned by
 * calculateQuoteTotals(currentItems, taxRate, discount).
 */

// ─── helpers ────────────────────────────────────────────────────────────────

const makeQuote = (
  id: string,
  userId: string,
  taxRate: number,
  discount: number,
) => ({
  id,
  publicId: `pub-${id}`,
  userId,
  clientId: null,
  title: 'Test Quote',
  status: QuoteStatus.DRAFT,
  currency: 'USD',
  subtotal: 0,
  taxRate,
  taxAmount: 0,
  total: 0,
  discount,
  notes: null,
  terms: null,
  validUntil: null,
  pdfUrl: null,
  sentAt: null,
  viewedAt: null,
  acceptedAt: null,
  rejectedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeItem = (
  id: string,
  quoteId: string,
  quantity: number,
  unitPrice: number,
  order = 0,
) => ({
  id,
  quoteId,
  name: `Item ${id}`,
  description: null,
  quantity,
  unitPrice,
  total: quantity * unitPrice,
  order,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─── test suite ─────────────────────────────────────────────────────────────

describe('QuoteItemsService — Property 11: Totals consistency after item modification', () => {
  let service: QuoteItemsService;
  let prisma: jest.Mocked<PrismaService>;

  // Tracks the current items in the "DB" for a given quoteId
  let dbItems: ReturnType<typeof makeItem>[];
  // Tracks the last quote.update call data
  let lastUpdatedTotals: { subtotal: number; taxAmount: number; total: number } | null;

  beforeEach(async () => {
    dbItems = [];
    lastUpdatedTotals = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteItemsService,
        {
          provide: PrismaService,
          useValue: {
            quote: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            quoteItem: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<QuoteItemsService>(QuoteItemsService);
    prisma = module.get(PrismaService);
  });

  it(
    'P11: after create item, DB totals match calculateQuoteTotals(currentItems)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // taxRate 0–100, discount 0–500, 0–4 pre-existing items, new item
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
          fc.array(
            fc.record({
              quantity: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
              unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
            }),
            { minLength: 0, maxLength: 4 },
          ),
          fc.record({
            quantity: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
            unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          }),
          async (taxRate, discount, existingItemInputs, newItemInput) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';

            // Build existing items
            dbItems = existingItemInputs.map((inp, idx) =>
              makeItem(`item-${idx}`, quoteId, inp.quantity, inp.unitPrice, idx),
            );

            const quote = makeQuote(quoteId, userId, taxRate, discount);

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(quote);
            (prisma.quote.findUnique as jest.Mock).mockResolvedValue(quote);
            (prisma.quoteItem.count as jest.Mock).mockResolvedValue(dbItems.length);

            // create returns a new item and adds it to dbItems
            (prisma.quoteItem.create as jest.Mock).mockImplementation(({ data }) => {
              const created = makeItem(
                `item-new`,
                quoteId,
                Number(data.quantity),
                Number(data.unitPrice),
                Number(data.order ?? dbItems.length),
              );
              dbItems = [...dbItems, created];
              return Promise.resolve(created);
            });

            // findMany returns current dbItems
            (prisma.quoteItem.findMany as jest.Mock).mockImplementation(() =>
              Promise.resolve(dbItems),
            );

            // Capture what totals were written to the DB
            (prisma.quote.update as jest.Mock).mockImplementation(({ data }) => {
              lastUpdatedTotals = {
                subtotal: Number(data.subtotal),
                taxAmount: Number(data.taxAmount),
                total: Number(data.total),
              };
              return Promise.resolve({ ...quote, ...data });
            });

            await service.create(userId, quoteId, {
              name: 'New Item',
              quantity: newItemInput.quantity,
              unitPrice: newItemInput.unitPrice,
            } as any);

            // Expected totals from the pure function
            const expected = calculateQuoteTotals(
              dbItems.map((i) => ({
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              })),
              taxRate,
              discount,
            );

            if (!lastUpdatedTotals) return false;

            const eps = 0.0001;
            return (
              Math.abs(lastUpdatedTotals.subtotal - expected.subtotal) < eps &&
              Math.abs(lastUpdatedTotals.taxAmount - expected.taxAmount) < eps &&
              Math.abs(lastUpdatedTotals.total - expected.total) < eps
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P11: after update item, DB totals match calculateQuoteTotals(currentItems)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
          fc.array(
            fc.record({
              quantity: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
              unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.record({
            quantity: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
            unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          }),
          fc.integer({ min: 0, max: 4 }),
          async (taxRate, discount, existingItemInputs, updatedValues, targetIdx) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';

            dbItems = existingItemInputs.map((inp, idx) =>
              makeItem(`item-${idx}`, quoteId, inp.quantity, inp.unitPrice, idx),
            );

            const safeIdx = targetIdx % dbItems.length;
            const targetItemId = dbItems[safeIdx].id;

            const quote = makeQuote(quoteId, userId, taxRate, discount);

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(quote);
            (prisma.quote.findUnique as jest.Mock).mockResolvedValue(quote);

            (prisma.quoteItem.findFirst as jest.Mock).mockImplementation(({ where }) =>
              Promise.resolve(dbItems.find((i) => i.id === where.id) ?? null),
            );

            (prisma.quoteItem.update as jest.Mock).mockImplementation(({ where, data }) => {
              dbItems = dbItems.map((i) => {
                if (i.id !== where.id) return i;
                const q = data.quantity !== undefined ? Number(data.quantity) : Number(i.quantity);
                const p = data.unitPrice !== undefined ? Number(data.unitPrice) : Number(i.unitPrice);
                return { ...i, quantity: q, unitPrice: p, total: q * p };
              });
              return Promise.resolve(dbItems.find((i) => i.id === where.id)!);
            });

            (prisma.quoteItem.findMany as jest.Mock).mockImplementation(() =>
              Promise.resolve(dbItems),
            );

            (prisma.quote.update as jest.Mock).mockImplementation(({ data }) => {
              lastUpdatedTotals = {
                subtotal: Number(data.subtotal),
                taxAmount: Number(data.taxAmount),
                total: Number(data.total),
              };
              return Promise.resolve({ ...quote, ...data });
            });

            await service.update(userId, quoteId, targetItemId, {
              quantity: updatedValues.quantity,
              unitPrice: updatedValues.unitPrice,
            } as any);

            const expected = calculateQuoteTotals(
              dbItems.map((i) => ({
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              })),
              taxRate,
              discount,
            );

            if (!lastUpdatedTotals) return false;

            const eps = 0.0001;
            return (
              Math.abs(lastUpdatedTotals.subtotal - expected.subtotal) < eps &&
              Math.abs(lastUpdatedTotals.taxAmount - expected.taxAmount) < eps &&
              Math.abs(lastUpdatedTotals.total - expected.total) < eps
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P11: after delete item, DB totals match calculateQuoteTotals(currentItems)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
          fc.array(
            fc.record({
              quantity: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
              unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.integer({ min: 0, max: 4 }),
          async (taxRate, discount, existingItemInputs, targetIdx) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';

            dbItems = existingItemInputs.map((inp, idx) =>
              makeItem(`item-${idx}`, quoteId, inp.quantity, inp.unitPrice, idx),
            );

            const safeIdx = targetIdx % dbItems.length;
            const targetItemId = dbItems[safeIdx].id;

            const quote = makeQuote(quoteId, userId, taxRate, discount);

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(quote);
            (prisma.quote.findUnique as jest.Mock).mockResolvedValue(quote);

            (prisma.quoteItem.findFirst as jest.Mock).mockImplementation(({ where }) =>
              Promise.resolve(dbItems.find((i) => i.id === where.id) ?? null),
            );

            (prisma.quoteItem.delete as jest.Mock).mockImplementation(({ where }) => {
              const deleted = dbItems.find((i) => i.id === where.id)!;
              dbItems = dbItems.filter((i) => i.id !== where.id);
              return Promise.resolve(deleted);
            });

            (prisma.quoteItem.findMany as jest.Mock).mockImplementation(() =>
              Promise.resolve(dbItems),
            );

            (prisma.quote.update as jest.Mock).mockImplementation(({ data }) => {
              lastUpdatedTotals = {
                subtotal: Number(data.subtotal),
                taxAmount: Number(data.taxAmount),
                total: Number(data.total),
              };
              return Promise.resolve({ ...quote, ...data });
            });

            await service.remove(userId, quoteId, targetItemId);

            const expected = calculateQuoteTotals(
              dbItems.map((i) => ({
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              })),
              taxRate,
              discount,
            );

            if (!lastUpdatedTotals) return false;

            const eps = 0.0001;
            return (
              Math.abs(lastUpdatedTotals.subtotal - expected.subtotal) < eps &&
              Math.abs(lastUpdatedTotals.taxAmount - expected.taxAmount) < eps &&
              Math.abs(lastUpdatedTotals.total - expected.total) < eps
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
