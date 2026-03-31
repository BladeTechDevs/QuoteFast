import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuotesSendService } from './quotes-send.service';
import { QuotesRemindersService } from './quotes-reminders.service';
import { SqsService } from './sqs.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [QuotesService, QuotesSendService, QuotesRemindersService, SqsService],
  controllers: [QuotesController],
  exports: [QuotesService, QuotesSendService],
})
export class QuotesModule {}
