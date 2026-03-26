import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        userId,
        name: dto.name,
        email: dto.email,
        company: dto.company,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, query: ListClientsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where: { userId } }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(userId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(userId, id);
    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        company: dto.company,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    const quoteCount = await this.prisma.quote.count({
      where: { clientId: id },
    });

    if (quoteCount > 0) {
      throw new ConflictException(
        'Client has associated quotes and cannot be deleted',
      );
    }

    await this.prisma.client.delete({ where: { id } });
  }
}
