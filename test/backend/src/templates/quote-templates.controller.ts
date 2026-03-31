import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteTemplatesService } from './quote-templates.service';
import { CreateQuoteTemplateDto } from './dto/create-quote-template.dto';
import { UpdateQuoteTemplateDto } from './dto/update-quote-template.dto';

@Controller('quote-templates')
@UseGuards(JwtAuthGuard)
export class QuoteTemplatesController {
  constructor(private readonly quoteTemplatesService: QuoteTemplatesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateQuoteTemplateDto) {
    return this.quoteTemplatesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.quoteTemplatesService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.quoteTemplatesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteTemplateDto,
  ) {
    return this.quoteTemplatesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.quoteTemplatesService.remove(req.user.id, id);
  }
}
