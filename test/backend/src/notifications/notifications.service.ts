import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  quoteId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(opts: CreateNotificationOptions): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        quoteId: opts.quoteId ?? null,
        metadata: (opts.metadata ?? null) as any,
      },
    });
  }

  async findAll(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteOld(userId: string): Promise<void> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await this.prisma.notification.deleteMany({
      where: { userId, createdAt: { lt: threeDaysAgo }, read: true },
    });
  }

  async deleteOldAll(): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: threeDaysAgo }, read: true },
    });
    return result.count;
  }
}
