import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import * as fc from 'fast-check';
import { QuoteStatus } from '@prisma/client';
import { QuoteItemsService } from './quote-items.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feature: saas-quote-platform, Property 9: Inmutabilidad de cotizaciones terminales
 *
 * Validates: Requirement 3.7
 *
 * For any quote in ACCEPTED, REJECTED, or EXPIRED state, any attempt to
 * create, update, or delete items must be rejected with a 422 error.
 */

const TERMINAL_STATES = [
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

const makeQuote = (id: string, userId: string, status: QuoteStatus) => ({
  id,
  publicId: `pub-${id}`,
  userId,
  clientId: null,
  title: 'Test Quote',
  status,
  currency: 'USD',
  subtotal: 0,
  taxRate: 0,
  taxAmount: 0,
  total: 0,
  discount: 0,
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

const makeItem = (id: string, quoteId: string) => ({
  id,
  quoteId,
  name: 'Item',
  description: null,
  quantity: 1,
  unitPrice: 100,
  total: 100,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('QuoteItemsService — Property 9: Terminal state immutability', () => {
  let service: QuoteItemsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
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
    'P9: create item on terminal quote always throws 422',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TERMINAL_STATES),
          async (status) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(
              makeQuote(quoteId, userId, status),
            );

            const dto = { name: 'New Item', quantity: 1, unitPrice: 50 };

            try {
              await service.create(userId, quoteId, dto as any);
              return false; // must not succeed
            } catch (err) {
              return err instanceof UnprocessableEntityException;
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P9: update item on terminal quote always throws 422',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TERMINAL_STATES),
          async (status) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';
            const itemId = 'item-1';

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(
              makeQuote(quoteId, userId, status),
            );
            (prisma.quoteItem.findFirst as jest.Mock).mockResolvedValue(
              makeItem(itemId, quoteId),
            );

            const dto = { name: 'Updated Item' };

            try {
              await service.update(userId, quoteId, itemId, dto as any);
              return false; // must not succeed
            } catch (err) {
              return err instanceof UnprocessableEntityException;
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P9: delete item on terminal quote always throws 422',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TERMINAL_STATES),
          async (status) => {
            const userId = 'user-1';
            const quoteId = 'quote-1';
            const itemId = 'item-1';

            (prisma.quote.findFirst as jest.Mock).mockResolvedValue(
              makeQuote(quoteId, userId, status),
            );
            (prisma.quoteItem.findFirst as jest.Mock).mockResolvedValue(
              makeItem(itemId, quoteId),
            );

            try {
              await service.remove(userId, quoteId, itemId);
              return false; // must not succeed
            } catch (err) {
              return err instanceof UnprocessableEntityException;
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
