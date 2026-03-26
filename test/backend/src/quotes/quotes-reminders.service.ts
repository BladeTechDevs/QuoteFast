import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SqsService } from './sqs.service';

@Injectable()
export class QuotesRemindersService {
  private readonly logger = new Logger(QuotesRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sqsService: SqsService,
  ) {}

  /**
   * Every day at 9am UTC:
   * - Notify owners of quotes sent 3+ days ago that haven't been viewed
   * - Mark quotes past their validUntil date as EXPIRED
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDailyJobs() {
    await Promise.all([
      this.sendFollowUpReminders(),
      this.expireOverdueQuotes(),
    ]);
  }

  private async sendFollowUpReminders() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const unviewedQuotes = await this.prisma.quote.findMany({
      where: {
        status: 'SENT',
        viewedAt: null,
        sentAt: { lte: threeDaysAgo },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const quote of unviewedQuotes) {
      try {
        await this.sqsService.enqueue({
          quoteId: quote.id,
          type: 'SEND_EMAIL',
          retryCount: 0,
        });
      } catch (err) {
        this.logger.error(`Failed to enqueue follow-up for quote ${quote.id}`, err);
      }
    }

    if (unviewedQuotes.length > 0) {
      this.logger.log(`Sent ${unviewedQuotes.length} follow-up reminder(s)`);
    }
  }

  private async expireOverdueQuotes() {
    const now = new Date();

    const result = await this.prisma.quote.updateMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        validUntil: { lt: now },
        deletedAt: null,
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} overdue quote(s)`);
    }
  }
}
