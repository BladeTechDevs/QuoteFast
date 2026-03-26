import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import * as fc from 'fast-check';
import { Plan, QuoteStatus } from '@prisma/client';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feature: saas-quote-platform, Property 8: Límite del plan FREE
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * For any FREE plan user, creating quotes in the same calendar month must
 * succeed for attempts 1–5 and throw ForbiddenException (403) on attempt 6+.
 */

const makeUser = (id: string) => ({
  id,
  email: `${id}@example.com`,
  passwordHash: 'hash',
  name: 'Test User',
  company: null,
  plan: Plan.FREE,
  refreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeQuote = (userId: string) => ({
  id: `quote-${Math.random()}`,
  publicId: `pub-${Math.random()}`,
  userId,
  clientId: null,
  title: 'Test Quote',
  status: QuoteStatus.DRAFT,
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
  items: [],
  client: null,
});

describe('QuotesService — Property 8: FREE plan monthly limit', () => {
  let service: QuotesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            quote: {
              count: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            template: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    prisma = module.get(PrismaService);
  });

  it(
    'P8: error 403 appears exactly on attempt 6 for FREE plan users',
    async () => {
      // fc.integer({min:1, max:10}) drives how many creation attempts we simulate
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (totalAttempts) => {
            const userId = 'free-user-id';
            const dto = { title: 'Quote' };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(
              makeUser(userId),
            );

            // Track how many quotes have been "created" so far this month
            let createdCount = 0;

            (prisma.quote.count as jest.Mock).mockImplementation(() =>
              Promise.resolve(createdCount),
            );

            (prisma.quote.create as jest.Mock).mockImplementation(() => {
              createdCount++;
              return Promise.resolve(makeQuote(userId));
            });

            const results: Array<'ok' | 'forbidden'> = [];

            for (let attempt = 1; attempt <= totalAttempts; attempt++) {
              try {
                await service.create(userId, dto as any);
                results.push('ok');
              } catch (err) {
                if (err instanceof ForbiddenException) {
                  results.push('forbidden');
                } else {
                  throw err;
                }
              }
            }

            // Attempts 1–5 must succeed; attempt 6+ must be forbidden
            for (let i = 0; i < results.length; i++) {
              const attempt = i + 1;
              if (attempt <= 5) {
                if (results[i] !== 'ok') return false;
              } else {
                if (results[i] !== 'forbidden') return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
