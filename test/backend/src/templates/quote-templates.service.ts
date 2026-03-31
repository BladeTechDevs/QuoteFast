import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteTemplateDto } from './dto/create-quote-template.dto';
import { UpdateQuoteTemplateDto } from './dto/update-quote-template.dto';

@Injectable()
export class QuoteTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateQuoteTemplateDto) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.quoteTemplate.create({
        data: {
          userId,
          name: dto.name,
          currency: dto.currency ?? 'USD',
          taxRate: dto.taxRate ?? 0,
          discount: dto.discount ?? 0,
          notes: dto.notes ?? null,
          terms: dto.terms ?? null,
          isDefault: false,
        },
      });

      if (dto.items && dto.items.length > 0) {
        await tx.templateItem.createMany({
          data: dto.items.map((item) => ({
            templateId: template.id,
            name: item.name,
            description: item.description ?? null,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            taxRate: item.taxRate ?? 0,
            internalCost: item.internalCost ?? 0,
            order: item.order,
          })),
        });
      }

      return tx.quoteTemplate.findUnique({
        where: { id: template.id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async findAll(userId: string) {
    return this.prisma.quoteTemplate.findMany({
      where: {
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.quoteTemplate.findFirst({
      where: {
        id,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!template) {
      throw new NotFoundException('Quote template not found');
    }

    return template;
  }

  async update(userId: string, id: string, dto: UpdateQuoteTemplateDto) {
    const template = await this.prisma.quoteTemplate.findFirst({
      where: { id, OR: [{ userId }, { isDefault: true, userId: null }] },
    });

    if (!template) {
      throw new NotFoundException('Quote template not found');
    }

    if (template.isDefault) {
      throw new ForbiddenException('Cannot modify system templates');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quoteTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
          ...(dto.discount !== undefined && { discount: dto.discount }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.terms !== undefined && { terms: dto.terms }),
        },
      });

      if (dto.items !== undefined) {
        await tx.templateItem.deleteMany({ where: { templateId: id } });

        if (dto.items.length > 0) {
          await tx.templateItem.createMany({
            data: dto.items.map((item) => ({
              templateId: id,
              name: item.name,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice,
              discount: item.discount ?? 0,
              taxRate: item.taxRate ?? 0,
              internalCost: item.internalCost ?? 0,
              order: item.order,
            })),
          });
        }
      }

      return tx.quoteTemplate.findUnique({
        where: { id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async remove(userId: string, id: string) {
    const template = await this.prisma.quoteTemplate.findFirst({
      where: { id, OR: [{ userId }, { isDefault: true, userId: null }] },
    });

    if (!template) {
      throw new NotFoundException('Quote template not found');
    }

    if (template.isDefault) {
      throw new ForbiddenException('Cannot modify system templates');
    }

    // Cascade delete handled by Prisma schema (onDelete: Cascade on TemplateItem)
    await this.prisma.quoteTemplate.delete({ where: { id } });
  }
}
