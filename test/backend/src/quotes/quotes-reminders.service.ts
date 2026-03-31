import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SqsService } from './sqs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuotesRemindersService {
  private readonly logger = new Logger(QuotesRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sqsService: SqsService,
    private readonly notifications: NotificationsService,
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
      this.purgeOldNotifications(),
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
      select: { id: true, title: true, userId: true },
    });

    for (const quote of unviewedQuotes) {
      try {
        await this.sqsService.enqueue({
          quoteId: quote.id,
          type: 'SEND_EMAIL',
          retryCount: 0,
        });
        await this.notifications.create({
          userId: quote.userId,
          type: 'QUOTE_REMINDER_SENT',
          title: 'Recordatorio enviado al cliente',
          message: `El cliente aún no ha abierto la cotización "${quote.title}" (enviada hace 3+ días). Se envió un recordatorio automático.`,
          quoteId: quote.id,
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

    const overdueQuotes = await this.prisma.quote.findMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        validUntil: { lt: now },
        deletedAt: null,
      },
      select: { id: true, title: true, userId: true },
    });

    if (overdueQuotes.length === 0) return;

    await this.prisma.quote.updateMany({
      where: { id: { in: overdueQuotes.map((q) => q.id) } },
      data: { status: 'EXPIRED' },
    });

    for (const quote of overdueQuotes) {
      await this.notifications.create({
        userId: quote.userId,
        type: 'QUOTE_EXPIRED',
        title: 'Cotización expirada',
        message: `La cotización "${quote.title}" expiró porque superó su fecha de validez sin ser aceptada.`,
        quoteId: quote.id,
      });
    }

    this.logger.log(`Expired ${overdueQuotes.length} overdue quote(s)`);
  }

  private async purgeOldNotifications() {
    const count = await this.notifications.deleteOldAll();
    if (count > 0) {
      this.logger.log(`Purged ${count} old notification(s)`);
    }
  }
}
