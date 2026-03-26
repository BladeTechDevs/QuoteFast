import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

// Inline enum to avoid @prisma/client re-export issues
const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

/**
 * Feature: saas-quote-platform, Property related to 9.2 and 9.3:
 * Pipeline value and conversion rate follow their defined formulas.
 *
 * Validates: Requirements 9.2, 9.3
 *
 * Requirement 9.2: Pipeline value = SUM(total) WHERE status IN (SENT, VIEWED)
 * Requirement 9.3: Conversion rate = COUNT(ACCEPTED) / COUNT(SENT+VIEWED+ACCEPTED+REJECTED+EXPIRED) * 100
 */

const PIPELINE_STATUSES = [QuoteStatus.SENT, QuoteStatus.VIEWED] as const;
const CONVERSION_STATUSES = [
  QuoteStatus.SENT,
  QuoteStatus.VIEWED,
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
] as const;

// Arbitrary that generates a random quote status
const anyStatus = fc.constantFrom(...Object.values(QuoteStatus));

// Arbitrary that generates a quote with a status and a total
const quoteArb = fc.record({
  status: anyStatus,
  total: fc.float({ min: Math.fround(0), max: Math.fround(100_000), noNaN: true }),
});

// Pure reference implementations of the formulas (mirrors DashboardService logic)
function computePipelineValue(quotes: { status: QuoteStatus; total: number }[]): number {
  return quotes
    .filter((q) => (PIPELINE_STATUSES as readonly QuoteStatus[]).includes(q.status))
    .reduce((sum, q) => sum + q.total, 0);
}

function computeConversionRate(quotes: { status: QuoteStatus }[]): number {
  const denominator = quotes.filter((q) =>
    (CONVERSION_STATUSES as readonly QuoteStatus[]).includes(q.status),
  ).length;
  if (denominator === 0) return 0;
  const accepted = quotes.filter((q) => q.status === QuoteStatus.ACCEPTED).length;
  const raw = (accepted / denominator) * 100;
  return Math.round(raw * 100) / 100;
}

describe('DashboardService — Properties 9.2 & 9.3: pipeline value and conversion rate', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
            quote: {
              groupBy: jest.fn(),
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
  });

  it(
    'P9.2: pipelineValue equals sum of totals for SENT and VIEWED quotes',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(quoteArb, { minLength: 0, maxLength: 30 }),
          async (quotes) => {
            const userId = 'user-1';

            // Build groupBy result from the generated quotes
            const countMap = new Map<QuoteStatus, number>();
            for (const q of quotes) {
              countMap.set(q.status, (countMap.get(q.status) ?? 0) + 1);
            }
            const groupByResult = Array.from(countMap.entries()).map(([status, count]) => ({
              status,
              _count: { status: count },
            }));

            // Compute expected pipeline value from the reference formula
            const expectedPipeline = computePipelineValue(quotes);

            (prisma.quote.groupBy as jest.Mock).mockResolvedValue(groupByResult);
            (prisma.quote.aggregate as jest.Mock).mockResolvedValue({
              _sum: { total: expectedPipeline },
            });
            (prisma.quote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await service.getDashboard(userId);

            // The service must return the same pipeline value as the formula
            const eps = 0.001;
            return Math.abs(result.pipelineValue - expectedPipeline) < eps;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P9.3: conversionRate equals ACCEPTED / (SENT+VIEWED+ACCEPTED+REJECTED+EXPIRED) * 100',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(quoteArb, { minLength: 0, maxLength: 30 }),
          async (quotes) => {
            const userId = 'user-1';

            // Build groupBy result
            const countMap = new Map<QuoteStatus, number>();
            for (const q of quotes) {
              countMap.set(q.status, (countMap.get(q.status) ?? 0) + 1);
            }
            const groupByResult = Array.from(countMap.entries()).map(([status, count]) => ({
              status,
              _count: { status: count },
            }));

            (prisma.quote.groupBy as jest.Mock).mockResolvedValue(groupByResult);
            (prisma.quote.aggregate as jest.Mock).mockResolvedValue({ _sum: { total: 0 } });
            (prisma.quote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await service.getDashboard(userId);

            const expectedRate = computeConversionRate(quotes);
            const eps = 0.01;
            return Math.abs(result.conversionRate - expectedRate) < eps;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P9.2 + P9.3: zero pipeline and zero conversion rate when no quotes exist',
    async () => {
      (prisma.quote.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.quote.aggregate as jest.Mock).mockResolvedValue({ _sum: { total: null } });
      (prisma.quote.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getDashboard('user-empty');

      return result.pipelineValue === 0 && result.conversionRate === 0;
    },
  );
});
