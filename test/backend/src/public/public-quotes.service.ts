import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { SqsService } from '../quotes/sqs.service';

const TERMINAL_STATES: QuoteStatus[] = [
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

@Injectable()
export class PublicQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
    private readonly sqsService: SqsService,
  ) {}

  async findByPublicId(publicId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      include: {
        items: { orderBy: { order: 'asc' } },
        client: { select: { name: true, company: true } },
        user: {
          select: {
            name: true,
            company: true,
            brandingSettings: {
              select: {
                logoUrl: true,
                primaryColor: true,
                accentColor: true,
                footerText: true,
                companyName: true,
              },
            },
          },
        },
        signature: { select: { signerName: true, signatureImage: true, signedAt: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    return this.toPublicShape(quote);
  }

  async getQuoteAndTrackOpen(
    publicId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      include: {
        items: { orderBy: { order: 'asc' } },
        client: { select: { name: true, company: true } },
        user: {
          select: {
            name: true,
            company: true,
            brandingSettings: {
              select: {
                logoUrl: true,
                primaryColor: true,
                accentColor: true,
                footerText: true,
                companyName: true,
              },
            },
          },
        },
        signature: { select: { signerName: true, signatureImage: true, signedAt: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Register tracking event fire-and-forget — don't block the response
    this.trackingService.registerEvent({
      quoteId: quote.id,
      eventType: TrackingEventType.QUOTE_OPENED,
      ipAddress,
      userAgent,
    }).catch(() => { /* ignore tracking errors */ });

    return this.toPublicShape(quote);
  }

  private toPublicShape(quote: {
    publicId: string;
    title: string;
    status: import('@prisma/client').QuoteStatus;
    currency: string;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      quantity: import('@prisma/client').Prisma.Decimal;
      unitPrice: import('@prisma/client').Prisma.Decimal;
      discount: import('@prisma/client').Prisma.Decimal;
      taxRate: import('@prisma/client').Prisma.Decimal;
      total: import('@prisma/client').Prisma.Decimal;
      order: number;
      // internalCost is intentionally excluded from the public shape
    }>;
    subtotal: import('@prisma/client').Prisma.Decimal;
    taxRate: import('@prisma/client').Prisma.Decimal;
    taxAmount: import('@prisma/client').Prisma.Decimal;
    discount: import('@prisma/client').Prisma.Decimal;
    total: import('@prisma/client').Prisma.Decimal;
    notes: string | null;
    terms: string | null;
    validUntil: Date | null;
    pdfUrl: string | null;
    user: {
      name: string;
      company: string | null;
      brandingSettings?: {
        logoUrl: string | null;
        primaryColor: string;
        accentColor: string;
        footerText: string | null;
        companyName: string | null;
      } | null;
    };
    client: { name: string; company: string | null } | null;
    signature?: { signerName: string; signatureImage: string; signedAt: Date } | null;
  }) {
    const b = quote.user.brandingSettings;
    return {
      publicId: quote.publicId,
      title: quote.title,
      status: quote.status,
      currency: quote.currency,
      items: quote.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        total: item.total,
        order: item.order,
        // internalCost is deliberately omitted — never exposed to public clients
      })),
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      discount: quote.discount,
      total: quote.total,
      notes: quote.notes,
      terms: quote.terms,
      validUntil: quote.validUntil,
      pdfUrl: quote.pdfUrl,
      issuer: { name: quote.user.name, company: quote.user.company },
      client: quote.client
        ? { name: quote.client.name, company: quote.client.company }
        : null,
      signature: quote.signature
        ? {
            signerName: quote.signature.signerName,
            signatureImage: quote.signature.signatureImage,
            signedAt: quote.signature.signedAt,
          }
        : null,
      branding: {
        logoUrl: b?.logoUrl ?? null,
        primaryColor: b?.primaryColor ?? '#2563eb',
        accentColor: b?.accentColor ?? '#1d4ed8',
        footerText: b?.footerText ?? null,
        companyName: b?.companyName ?? null,
      },
    };
  }

  async accept(
    publicId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      select: { id: true, status: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (TERMINAL_STATES.includes(quote.status)) {
      throw new UnprocessableEntityException(
        'Quote cannot be accepted in its current state',
      );
    }

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
    });

    await this.trackingService.registerEvent({
      quoteId: quote.id,
      eventType: TrackingEventType.QUOTE_ACCEPTED,
      ipAddress,
      userAgent,
    });

    // Notify owner via SQS (only if AWS is configured)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      await this.sqsService.enqueue({
        quoteId: quote.id,
        type: 'SEND_EMAIL',
        retryCount: 0,
      });
    }
  }

  async reject(
    publicId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      select: { id: true, status: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (TERMINAL_STATES.includes(quote.status)) {
      throw new UnprocessableEntityException(
        'Quote cannot be rejected in its current state',
      );
    }

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.REJECTED, rejectedAt: new Date() },
    });

    await this.trackingService.registerEvent({
      quoteId: quote.id,
      eventType: TrackingEventType.QUOTE_REJECTED,
      ipAddress,
      userAgent,
    });

    // Notify owner via SQS (only if AWS is configured)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      await this.sqsService.enqueue({
        quoteId: quote.id,
        type: 'SEND_EMAIL',
        retryCount: 0,
      });
    }
  }

  async trackPdfDownload(
    publicId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      select: { id: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    await this.trackingService.registerEvent({
      quoteId: quote.id,
      eventType: TrackingEventType.QUOTE_PDF_DOWNLOADED,
      ipAddress,
      userAgent,
    });
  }
}
