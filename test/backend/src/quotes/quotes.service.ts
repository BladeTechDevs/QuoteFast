import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Plan, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateItemTotal, calculateQuoteTotals } from './utils/calculate-totals';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ListQuotesDto } from './dto/list-quotes.dto';
import { NotificationsService } from '../notifications/notifications.service';

const TERMINAL_STATES: QuoteStatus[] = [
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

const FREE_PLAN_MONTHLY_LIMIT = 5;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateQuoteDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.plan === Plan.FREE) {
      await this.enforceFreePlanLimit(userId);
    }

    // Pre-populate fields from template if templateId is provided
    let templateDefaults: Record<string, any> = {};
    if (dto.templateId) {
      const template = await this.prisma.template.findFirst({
        where: {
          id: dto.templateId,
          OR: [{ userId }, { isDefault: true, userId: null }],
        },
      });
      if (template && template.content && typeof template.content === 'object') {
        templateDefaults = template.content as Record<string, any>;
      }
    }

    const quote = await this.prisma.quote.create({
      data: {
        userId,
        title: dto.title,
        clientId: dto.clientId ?? null,
        currency: dto.currency ?? templateDefaults['currency'] ?? 'USD',
        taxRate: dto.taxRate ?? templateDefaults['taxRate'] ?? 0,
        discount: dto.discount ?? templateDefaults['discount'] ?? 0,
        notes: dto.notes ?? templateDefaults['notes'] ?? null,
        terms: dto.terms ?? templateDefaults['terms'] ?? null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: QuoteStatus.DRAFT,
      },
      include: { items: true, client: true },
    });

    // Notify creation
    await this.notifications.create({
      userId,
      type: 'QUOTE_CREATED',
      title: 'Cotización creada',
      message: `La cotización "${quote.title}" fue creada en estado borrador. Agrega ítems y envíala cuando esté lista.`,
      quoteId: quote.id,
    });

    // Warn about plan limits after creation
    if (user?.plan === Plan.FREE) {
      await this.notifyPlanUsage(userId, quote.id);
    }

    return quote;
  }

  async findAll(userId: string, query: ListQuotesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip,
        take: limit,
        include: { client: true, items: true },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(userId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, userId, deletedAt: null },
      include: { items: { orderBy: { order: 'asc' } }, client: true },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }

  async update(userId: string, id: string, dto: UpdateQuoteDto) {
    await this.findOne(userId, id);

    return this.prisma.quote.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.clientId !== undefined && { clientId: dto.clientId }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.terms !== undefined && { terms: dto.terms }),
        ...(dto.validUntil !== undefined && {
          validUntil: new Date(dto.validUntil),
        }),
      },
      include: { items: { orderBy: { order: 'asc' } }, client: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // Soft delete — preserves audit trail
    await this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async duplicate(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.plan === Plan.FREE) {
      await this.enforceFreePlanLimit(userId);
    }

    const original = await this.findOne(userId, id);

    const copy = await this.prisma.quote.create({
      data: {
        userId,
        title: `${original.title} (copy)`,
        clientId: original.clientId,
        currency: original.currency,
        taxRate: original.taxRate,
        discount: original.discount,
        notes: original.notes,
        terms: original.terms,
        validUntil: original.validUntil,
        status: QuoteStatus.DRAFT,
        subtotal: original.subtotal,
        taxAmount: original.taxAmount,
        total: original.total,
      },
    });

    if (original.items.length > 0) {
      await this.prisma.quoteItem.createMany({
        data: original.items.map((item) => ({
          quoteId: copy.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          order: item.order,
        })),
      });
    }

    return this.prisma.quote.findUnique({
      where: { id: copy.id },
      include: { items: { orderBy: { order: 'asc' } }, client: true },
    });
  }

  async recalculate(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId, deletedAt: null },
      include: { items: { orderBy: { order: 'asc' } }, client: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (TERMINAL_STATES.includes(quote.status)) {
      throw new UnprocessableEntityException(
        `Cannot recalculate a quote in ${quote.status} status`,
      );
    }

    // Recalculate each item.total and persist
    for (const item of quote.items) {
      const newTotal = calculateItemTotal({
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
      });
      await this.prisma.quoteItem.update({
        where: { id: item.id },
        data: { total: newTotal },
      });
    }

    // Recalculate quote totals
    const totals = calculateQuoteTotals(
      quote.items.map((i) => ({
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        taxRate: Number(i.taxRate),
      })),
      Number(quote.taxRate),
      Number(quote.discount),
    );

    return this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
      include: { items: { orderBy: { order: 'asc' } }, client: true },
    });
  }

  private async enforceFreePlanLimit(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const count = await this.prisma.quote.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (count >= FREE_PLAN_MONTHLY_LIMIT) {
      await this.notifications.create({
        userId,
        type: 'PLAN_LIMIT_REACHED',
        title: 'Límite de cotizaciones alcanzado',
        message: `Has alcanzado el límite de ${FREE_PLAN_MONTHLY_LIMIT} cotizaciones del plan gratuito este mes. Actualiza tu plan para continuar.`,
      });
      throw new ForbiddenException(
        'Free plan limit reached: maximum 5 quotes per month. Please upgrade your plan.',
      );
    }
  }

  private async notifyPlanUsage(userId: string, quoteId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const count = await this.prisma.quote.count({
      where: { userId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });

    const remaining = FREE_PLAN_MONTHLY_LIMIT - count;

    if (remaining === 2) {
      await this.notifications.create({
        userId,
        type: 'PLAN_LIMIT_WARNING',
        title: 'Te quedan 2 cotizaciones este mes',
        message: `Con tu plan gratuito puedes crear ${FREE_PLAN_MONTHLY_LIMIT} cotizaciones por mes. Te quedan 2. Considera actualizar tu plan.`,
        quoteId,
      });
    } else if (remaining === 1) {
      await this.notifications.create({
        userId,
        type: 'PLAN_LIMIT_WARNING',
        title: 'Te queda 1 cotización este mes',
        message: `Esta es tu última cotización disponible del plan gratuito este mes. Actualiza tu plan para crear más sin límites.`,
        quoteId,
      });
    }
  }
}
