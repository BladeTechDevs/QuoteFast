import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feature: saas-quote-platform, Property 6: viewedAt se actualiza solo una vez
 *
 * Validates: Requirements 5.4, 5.5
 *
 * For any quote, no matter how many QUOTE_OPENED tracking events are registered,
 * the viewedAt field must be set exactly on the first open and must not change
 * on subsequent opens.
 */

describe('TrackingService — Property 6: viewedAt updates only once', () => {
  let service: TrackingService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        {
          provide: PrismaService,
          useValue: {
            trackingEvent: { create: jest.fn() },
            quote: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    prisma = module.get(PrismaService);
  });

  it(
    'P6: viewedAt is set on first open and never updated on subsequent opens',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // N between 1 and 20 simulated opens
          fc.integer({ min: 1, max: 20 }),
          async (totalOpens) => {
            jest.clearAllMocks();

            const quoteId = 'quote-abc';
            // Track the current viewedAt state as the service would see it
            let currentViewedAt: Date | null = null;
            let updateCallCount = 0;

            (prisma.trackingEvent.create as jest.Mock).mockResolvedValue({});

            // Simulate the quote state: viewedAt starts null, gets set after first open
            (prisma.quote.findUnique as jest.Mock).mockImplementation(() =>
              Promise.resolve({
                viewedAt: currentViewedAt,
                status: QuoteStatus.SENT,
              }),
            );

            (prisma.quote.update as jest.Mock).mockImplementation(() => {
              updateCallCount++;
              currentViewedAt = new Date();
              return Promise.resolve({});
            });

            // Simulate N opens
            for (let i = 0; i < totalOpens; i++) {
              await service.registerEvent({
                quoteId,
                eventType: TrackingEventType.QUOTE_OPENED,
                ipAddress: `1.2.3.${i}`,
                userAgent: `agent-${i}`,
              });
            }

            // viewedAt must have been set exactly once regardless of N
            if (updateCallCount !== 1) return false;

            // Every open must have created a tracking event
            const createCalls = (prisma.trackingEvent.create as jest.Mock).mock
              .calls.length;
            if (createCalls !== totalOpens) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P6: viewedAt is never updated when quote already has viewedAt set',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (totalOpens) => {
            jest.clearAllMocks();

            const quoteId = 'quote-xyz';
            const existingViewedAt = new Date('2024-01-01T10:00:00Z');

            (prisma.trackingEvent.create as jest.Mock).mockResolvedValue({});

            // Quote already has viewedAt set (not the first open)
            (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
              viewedAt: existingViewedAt,
              status: QuoteStatus.VIEWED,
            });

            for (let i = 0; i < totalOpens; i++) {
              await service.registerEvent({
                quoteId,
                eventType: TrackingEventType.QUOTE_OPENED,
              });
            }

            // update must never be called when viewedAt is already set
            const updateCalls = (prisma.quote.update as jest.Mock).mock.calls
              .length;
            return updateCalls === 0;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
