import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SqsService } from './sqs.service';

@Injectable()
export class QuotesSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sqsService: SqsService,
  ) {}

  async send(userId: string, quoteId: string): Promise<void> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: { items: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.items.length === 0) {
      throw new UnprocessableEntityException(
        'Cannot send a quote with no items. Please add at least one item.',
      );
    }

    // Update quote status to SENT and set sentAt timestamp
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Only enqueue to SQS if AWS credentials are configured
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      await this.sqsService.enqueue({
        quoteId: quote.id,
        type: 'SEND_QUOTE',
        retryCount: 0,
      });
    } else {
      // In development without AWS, just log
      console.log(`[DEV] Quote ${quote.id} marked as SENT (SQS skipped - no AWS credentials)`);
    }
  }
}
