import { Injectable } from '@nestjs/common';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterEventOptions {
  quoteId: string;
  eventType: TrackingEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async registerEvent(options: RegisterEventOptions): Promise<void> {
    const { quoteId, eventType, ipAddress, userAgent, metadata } = options;

    await this.prisma.trackingEvent.create({
      data: {
        quoteId,
        eventType,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: (metadata ?? null) as any,
      },
    });

    // For QUOTE_OPENED: update viewedAt only on first open, update status if SENT
    if (eventType === TrackingEventType.QUOTE_OPENED) {
      const quote = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        select: { viewedAt: true, status: true },
      });

      if (quote && quote.viewedAt === null) {
        await this.prisma.quote.update({
          where: { id: quoteId },
          data: {
            viewedAt: new Date(),
            ...(quote.status === QuoteStatus.SENT && {
              status: QuoteStatus.VIEWED,
            }),
          },
        });
      }
    }
  }
}
