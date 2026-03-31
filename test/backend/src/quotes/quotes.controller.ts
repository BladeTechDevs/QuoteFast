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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotesService } from './quotes.service';
import { QuotesSendService } from './quotes-send.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ListQuotesDto } from './dto/list-quotes.dto';
import { SaveQuoteAsTemplateDto } from '../templates/dto/save-quote-as-template.dto';

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotesSendService: QuotesSendService,
  ) {}

  @Post()
  create(@Request() req, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req, @Query() query: ListQuotesDto) {
    return this.quotesService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.quotesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id') id: string) {
    return this.quotesService.remove(req.user.id, id);
  }

  @Post(':id/duplicate')
  duplicate(@Request() req, @Param('id') id: string) {
    return this.quotesService.duplicate(req.user.id, id);
  }

  @Post(':id/recalculate')
  recalculate(@Request() req, @Param('id') id: string) {
    return this.quotesService.recalculate(req.user.id, id);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  send(@Request() req, @Param('id') id: string) {
    return this.quotesSendService.send(req.user.id, id);
  }

  @Post(':id/save-as-template')
  saveAsTemplate(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SaveQuoteAsTemplateDto,
  ) {
    return this.quotesService.saveAsTemplate(req.user.id, id, dto);
  }
}
