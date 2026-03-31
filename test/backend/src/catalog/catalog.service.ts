import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { ListCatalogItemsDto } from './dto/list-catalog-items.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCatalogItemDto) {
    return this.prisma.catalogItem.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        unitPrice: dto.unitPrice,
        taxRate: dto.taxRate ?? 0,
        discount: dto.discount ?? 0,
        internalCost: dto.internalCost ?? 0,
      },
    });
  }

  async findAll(userId: string, dto: ListCatalogItemsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async update(userId: string, id: string, dto: UpdateCatalogItemDto) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }

    return this.prisma.catalogItem.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        unitPrice: dto.unitPrice,
        taxRate: dto.taxRate,
        discount: dto.discount,
        internalCost: dto.internalCost,
      },
    });
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }

    await this.prisma.catalogItem.delete({ where: { id } });
  }
}
