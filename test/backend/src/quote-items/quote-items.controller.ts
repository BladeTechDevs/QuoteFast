import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteItemsService } from './quote-items.service';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

@Controller('quotes/:quoteId/items')
@UseGuards(JwtAuthGuard)
export class QuoteItemsController {
  constructor(private readonly quoteItemsService: QuoteItemsService) {}

  @Post()
  create(
    @Request() req,
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateQuoteItemDto,
  ) {
    return this.quoteItemsService.create(req.user.id, quoteId, dto);
  }

  @Patch(':itemId')
  update(
    @Request() req,
    @Param('quoteId') quoteId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuoteItemDto,
  ) {
    return this.quoteItemsService.update(req.user.id, quoteId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req,
    @Param('quoteId') quoteId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.quoteItemsService.remove(req.user.id, quoteId, itemId);
  }
}
