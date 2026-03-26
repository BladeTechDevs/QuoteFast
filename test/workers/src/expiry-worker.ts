import { ScheduledEvent } from 'aws-lambda';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { getPrismaClient } from './lib/prisma';

export async function handler(_event: ScheduledEvent): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();

  // Find all quotes that should be expired:
  // validUntil < now AND status NOT IN (ACCEPTED, REJECTED, EXPIRED)
  const expiredQuotes = await prisma.quote.findMany({
    where: {
      validUntil: { lt: now },
      status: {
        notIn: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
      },
    },
    select: { id: true },
  });

  if (expiredQuotes.length === 0) {
    console.log('No quotes to expire.');
    return;
  }

  console.log(`Expiring ${expiredQuotes.length} quote(s)...`);

  const quoteIds = expiredQuotes.map((q) => q.id);

  // Update all matching quotes to EXPIRED in one query
  await prisma.quote.updateMany({
    where: { id: { in: quoteIds } },
    data: { status: QuoteStatus.EXPIRED },
  });

  // Register a QUOTE_EXPIRED TrackingEvent for each expired quote
  await prisma.trackingEvent.createMany({
    data: quoteIds.map((quoteId) => ({
      quoteId,
      eventType: TrackingEventType.QUOTE_EXPIRED,
    })),
  });

  console.log(`Successfully expired ${quoteIds.length} quote(s).`);
}
