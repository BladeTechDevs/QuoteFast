import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateQuoteTotals } from '../quotes/utils/calculate-totals';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

const TERMINAL_STATES: QuoteStatus[] = [
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

@Injectable()
export class QuoteItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, quoteId: string, dto: CreateQuoteItemDto) {
    const quote = await this.getQuoteForUser(userId, quoteId);
    this.assertNotTerminal(quote.status);

    const itemTotal = dto.quantity * dto.unitPrice;

    // Determine order: place at end if not specified
    const order =
      dto.order ??
      (await this.prisma.quoteItem.count({ where: { quoteId } }));

    const item = await this.prisma.quoteItem.create({
      data: {
        quoteId,
        name: dto.name,
        description: dto.description ?? null,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        total: itemTotal,
        order,
      },
    });

    await this.recalculateTotals(quoteId);
    return item;
  }

  async update(
    userId: string,
    quoteId: string,
    itemId: string,
    dto: UpdateQuoteItemDto,
  ) {
    const quote = await this.getQuoteForUser(userId, quoteId);
    this.assertNotTerminal(quote.status);

    const item = await this.prisma.quoteItem.findFirst({
      where: { id: itemId, quoteId },
    });
    if (!item) {
      throw new NotFoundException('Quote item not found');
    }

    const newQuantity =
      dto.quantity !== undefined ? dto.quantity : Number(item.quantity);
    const newUnitPrice =
      dto.unitPrice !== undefined ? dto.unitPrice : Number(item.unitPrice);
    const newTotal = newQuantity * newUnitPrice;

    const updated = await this.prisma.quoteItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.order !== undefined && { order: dto.order }),
        total: newTotal,
      },
    });

    await this.recalculateTotals(quoteId);
    return updated;
  }

  async remove(userId: string, quoteId: string, itemId: string) {
    const quote = await this.getQuoteForUser(userId, quoteId);
    this.assertNotTerminal(quote.status);

    const item = await this.prisma.quoteItem.findFirst({
      where: { id: itemId, quoteId },
    });
    if (!item) {
      throw new NotFoundException('Quote item not found');
    }

    await this.prisma.quoteItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(quoteId);
  }

  private async getQuoteForUser(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }

  private assertNotTerminal(status: QuoteStatus) {
    if (TERMINAL_STATES.includes(status)) {
      throw new UnprocessableEntityException(
        `Cannot modify items of a quote in ${status} status`,
      );
    }
  }

  private async recalculateTotals(quoteId: string) {
    const [quote, items] = await Promise.all([
      this.prisma.quote.findUnique({ where: { id: quoteId } }),
      this.prisma.quoteItem.findMany({ where: { quoteId } }),
    ]);

    if (!quote) return;

    const totals = calculateQuoteTotals(
      items.map((i) => ({
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      Number(quote.taxRate),
      Number(quote.discount),
    );

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    });
  }
}
