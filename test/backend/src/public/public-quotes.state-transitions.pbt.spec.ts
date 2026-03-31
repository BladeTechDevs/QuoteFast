import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import * as fc from 'fast-check';
import { QuoteStatus } from '@prisma/client';
import { PublicQuotesService } from './public-quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { SqsService } from '../quotes/sqs.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Feature: saas-quote-platform, Property 5: Transiciones de estado válidas
 *
 * Validates: Requirements 3.7, 6.4, 7.3
 *
 * For any quote in a terminal state (ACCEPTED, REJECTED, EXPIRED),
 * calling accept() or reject() must always return a 422 error.
 */

const TERMINAL_STATES = [
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

describe('PublicQuotesService — Property 5: Valid state transitions', () => {
  let service: PublicQuotesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicQuotesService,
        {
          provide: PrismaService,
          useValue: {
            quote: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: TrackingService,
          useValue: { registerEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SqsService,
          useValue: { enqueue: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<PublicQuotesService>(PublicQuotesService);
    prisma = module.get(PrismaService);
  });

  it(
    'P5: accept() on any terminal state always throws 422',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TERMINAL_STATES),
          async (status) => {
            jest.clearAllMocks();

            (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
              id: 'quote-1',
              status,
            });

            try {
              await service.accept('some-public-id');
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
    'P5: reject() on any terminal state always throws 422',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TERMINAL_STATES),
          async (status) => {
            jest.clearAllMocks();

            (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
              id: 'quote-1',
              status,
            });

            try {
              await service.reject('some-public-id');
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
