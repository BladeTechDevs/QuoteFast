import { Module } from '@nestjs/common';
import { PublicQuotesService } from './public-quotes.service';
import { PublicController } from './public.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { QuotesModule } from '../quotes/quotes.module';
import { SqsService } from '../quotes/sqs.service';
import { SignatureService } from './signature.service';

@Module({
  imports: [TrackingModule, QuotesModule],
  providers: [PublicQuotesService, SqsService, SignatureService],
  controllers: [PublicController],
})
export class PublicModule {}
