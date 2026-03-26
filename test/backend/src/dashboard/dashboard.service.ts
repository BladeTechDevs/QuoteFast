import { Injectable } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PIPELINE_STATUSES = [QuoteStatus.SENT, QuoteStatus.VIEWED];
const CONVERSION_STATUSES = [
  QuoteStatus.SENT,
  QuoteStatus.VIEWED,
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const [statusCounts, pipelineResult, recentQuotes, avgAcceptTime] =
      await Promise.all([
        // Count by status
        this.prisma.quote.groupBy({
          by: ['status'],
          where: { userId, deletedAt: null },
          _count: { status: true },
        }),

        // Pipeline value (sent + viewed)
        this.prisma.quote.aggregate({
          where: { userId, status: { in: PIPELINE_STATUSES }, deletedAt: null },
          _sum: { total: true },
          _avg: { total: true },
        }),

        // Recent quotes (last 10)
        this.prisma.quote.findMany({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            total: true,
            updatedAt: true,
            client: { select: { id: true, name: true, company: true } },
          },
        }),

        // Average days to accept (accepted quotes with sentAt)
        this.prisma.quote.findMany({
          where: {
            userId,
            status: QuoteStatus.ACCEPTED,
            sentAt: { not: null },
            acceptedAt: { not: null },
            deletedAt: null,
          },
          select: { sentAt: true, acceptedAt: true },
          take: 50,
        }),
      ]);

    // Build status count map
    const countsByStatus: Record<string, number> = {};
    for (const status of Object.values(QuoteStatus)) {
      countsByStatus[status] = 0;
    }
    for (const row of statusCounts) {
      countsByStatus[row.status] = row._count.status;
    }

    // Conversion rate
    const totalSent = CONVERSION_STATUSES.reduce(
      (sum, s) => sum + (countsByStatus[s] ?? 0),
      0,
    );
    const accepted = countsByStatus[QuoteStatus.ACCEPTED] ?? 0;
    const conversionRate = totalSent > 0 ? (accepted / totalSent) * 100 : 0;

    // Open rate (viewed / sent)
    const viewed = countsByStatus[QuoteStatus.VIEWED] ?? 0;
    const openRate =
      totalSent > 0 ? ((viewed + accepted) / totalSent) * 100 : 0;

    // Average days to accept
    let avgDaysToAccept: number | null = null;
    if (avgAcceptTime.length > 0) {
      const totalMs = avgAcceptTime.reduce((sum, q) => {
        if (!q.sentAt || !q.acceptedAt) return sum;
        return sum + (q.acceptedAt.getTime() - q.sentAt.getTime());
      }, 0);
      avgDaysToAccept =
        Math.round((totalMs / avgAcceptTime.length / 86400000) * 10) / 10;
    }

    return {
      quotesByStatus: countsByStatus,
      statusCounts: countsByStatus,
      pipelineValue: Number(pipelineResult._sum.total ?? 0),
      avgQuoteValue: Number(pipelineResult._avg?.total ?? 0),
      conversionRate: Math.round(conversionRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      avgDaysToAccept,
      recentQuotes,
    };
  }
}
