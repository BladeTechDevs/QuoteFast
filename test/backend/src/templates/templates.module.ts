import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { QuoteTemplatesService } from './quote-templates.service';
import { QuoteTemplatesController } from './quote-templates.controller';

@Module({
  providers: [TemplatesService, QuoteTemplatesService],
  controllers: [TemplatesController, QuoteTemplatesController],
  exports: [TemplatesService, QuoteTemplatesService],
})
export class TemplatesModule {}
