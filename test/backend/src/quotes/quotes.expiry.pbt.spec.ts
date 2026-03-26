import * as fc from 'fast-check';
import { QuoteStatus, TrackingEventType } from '@prisma/client';

/**
 * Feature: saas-quote-platform, Property 12: Expiración no afecta estados terminales
 *
 * Validates: Requirement 7.3
 *
 * For any quote in ACCEPTED or REJECTED state with validUntil in the past,
 * the expiry process must NOT change its status.
 */

// Inline the expiry logic (mirrors expiry-worker.ts handler) so we can test it
// without Lambda infrastructure, using a mock Prisma client.
async function runExpiryProcess(prisma: {
  quote: {
    findMany: (args: any) => Promise<{ id: string }[]>;
    updateMany: (args: any) => Promise<any>;
  };
  trackingEvent: {
    createMany: (args: any) => Promise<any>;
  };
}): Promise<void> {
  const now = new Date();

  const expiredQuotes = await prisma.quote.findMany({
    where: {
      validUntil: { lt: now },
      status: {
        notIn: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
      },
    },
    select: { id: true },
  });

  if (expiredQuotes.length === 0) return;

  const quoteIds = expiredQuotes.map((q: { id: string }) => q.id);

  await prisma.quote.updateMany({
    where: { id: { in: quoteIds } },
    data: { status: QuoteStatus.EXPIRED },
  });

  await prisma.trackingEvent.createMany({
    data: quoteIds.map((quoteId: string) => ({
      quoteId,
      eventType: TrackingEventType.QUOTE_EXPIRED,
    })),
  });
}

const TERMINAL_STATES = [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED] as const;

const NON_TERMINAL_EXPIRABLE_STATES = [
  QuoteStatus.DRAFT,
  QuoteStatus.SENT,
  QuoteStatus.VIEWED,
] as const;

describe('Expiry Worker — Property 12: Expiración no afecta estados terminales', () => {
  it(
    'P12: quotes in ACCEPTED or REJECTED are never included in expiry updates',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a mix of terminal and non-terminal quotes, all with validUntil in the past
          fc.array(
            fc.record({
              id: fc.uuid(),
              status: fc.constantFrom(...TERMINAL_STATES),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          async (terminalQuotes) => {
            const updatedIds: string[] = [];
            const createdTrackingIds: string[] = [];

            const mockPrisma = {
              quote: {
                findMany: jest.fn().mockImplementation((args: any) => {
                  // Simulate the DB filter: exclude ACCEPTED, REJECTED, EXPIRED
                  const excluded: QuoteStatus[] = args.where.status.notIn;
                  return Promise.resolve(
                    terminalQuotes
                      .filter((q) => !excluded.includes(q.status))
                      .map((q) => ({ id: q.id })),
                  );
                }),
                updateMany: jest.fn().mockImplementation((args: any) => {
                  updatedIds.push(...args.where.id.in);
                  return Promise.resolve({ count: args.where.id.in.length });
                }),
              },
              trackingEvent: {
                createMany: jest.fn().mockImplementation((args: any) => {
                  createdTrackingIds.push(
                    ...args.data.map((d: any) => d.quoteId),
                  );
                  return Promise.resolve({ count: args.data.length });
                }),
              },
            };

            await runExpiryProcess(mockPrisma);

            // No terminal-state quote should ever be updated or get a tracking event
            const terminalIds = new Set(terminalQuotes.map((q) => q.id));
            const anyTerminalUpdated = updatedIds.some((id) =>
              terminalIds.has(id),
            );
            const anyTerminalTracked = createdTrackingIds.some((id) =>
              terminalIds.has(id),
            );

            return !anyTerminalUpdated && !anyTerminalTracked;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P12: non-terminal quotes with validUntil in the past ARE expired',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              status: fc.constantFrom(...NON_TERMINAL_EXPIRABLE_STATES),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          async (expirableQuotes) => {
            const updatedIds: string[] = [];

            const mockPrisma = {
              quote: {
                findMany: jest.fn().mockImplementation((args: any) => {
                  const excluded: QuoteStatus[] = args.where.status.notIn;
                  return Promise.resolve(
                    expirableQuotes
                      .filter((q) => !excluded.includes(q.status))
                      .map((q) => ({ id: q.id })),
                  );
                }),
                updateMany: jest.fn().mockImplementation((args: any) => {
                  updatedIds.push(...args.where.id.in);
                  return Promise.resolve({ count: args.where.id.in.length });
                }),
              },
              trackingEvent: {
                createMany: jest.fn().mockResolvedValue({}),
              },
            };

            await runExpiryProcess(mockPrisma);

            // Every non-terminal quote must have been expired
            const expirableIds = new Set(expirableQuotes.map((q) => q.id));
            return expirableQuotes.every((q) => updatedIds.includes(q.id)) &&
              updatedIds.every((id) => expirableIds.has(id));
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
