import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface SignQuoteParams {
  publicId: string;
  signerName: string;
  signatureImage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignatureResponse {
  id: string;
  quoteStatus: QuoteStatus;
  signedAt: Date;
}

@Injectable()
export class SignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotesService: QuotesService,
    private readonly trackingService: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Validate signer name
   * @throws BadRequestException if invalid
   */
  validateSignerName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Signer name cannot be empty');
    }
    if (trimmed.length > 255) {
      throw new BadRequestException('Signer name cannot exceed 255 characters');
    }
  }

  /**
   * Validate signature image format and size
   * @throws BadRequestException if invalid
   */
  validateSignatureImage(image: string): void {
    // Check format
    const dataUriRegex = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/;
    const match = image.match(dataUriRegex);

    if (!match) {
      throw new BadRequestException(
        'Signature image must be a valid base64 data URI with image MIME type',
      );
    }

    // Check size (decode and measure)
    const base64Data = match[2];
    const sizeInBytes = Buffer.from(base64Data, 'base64').length;
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB

    if (sizeInBytes > maxSizeInBytes) {
      throw new BadRequestException('Signature image cannot exceed 5MB');
    }
  }

  /**
   * Process a quote signature
   * @throws NotFoundException if quote doesn't exist
   * @throws BadRequestException if validation fails
   * @throws ConflictException if quote not in signable state
   */
  async signQuote(params: SignQuoteParams): Promise<SignatureResponse> {
    const { publicId, signerName, signatureImage, ipAddress, userAgent } = params;

    // Validate inputs
    this.validateSignerName(signerName);
    if (signatureImage) {
      this.validateSignatureImage(signatureImage);
    }

    // Fetch quote by publicId
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Validate quote status is SENT or VIEWED
    if (quote.status !== QuoteStatus.SENT && quote.status !== QuoteStatus.VIEWED) {
      throw new ConflictException('Quote cannot be signed in its current state');
    }

    // Use Prisma transaction to create/update signature and update quote status
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert signature (create or replace if exists)
      const signature = await tx.signature.upsert({
        where: { quoteId: quote.id },
        create: {
          quoteId: quote.id,
          signerName: signerName.trim(),
          signatureImage: signatureImage ?? '',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
        update: {
          signerName: signerName.trim(),
          signatureImage: signatureImage ?? '',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          signedAt: new Date(),
        },
      });

      // Update quote status to ACCEPTED and set signedAt + acceptedAt
      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: QuoteStatus.ACCEPTED,
          signedAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      return { signature, quote: updatedQuote };
    });

    // Register tracking event
    await this.trackingService.registerEvent({
      quoteId: quote.id,
      eventType: TrackingEventType.QUOTE_ACCEPTED,
      ipAddress,
      userAgent,
      metadata: {
        signerName: signerName.trim(),
        via: 'signature',
      },
    });

    // Notify owner that the quote was signed
    await this.notifications.create({
      userId: quote.userId,
      type: 'QUOTE_SIGNED_BY_CLIENT',
      title: '¡Cotización firmada!',
      message: `${signerName.trim()} firmó electrónicamente la cotización "${quote.title}". La cotización está aceptada.`,
      quoteId: quote.id,
      metadata: { signerName: signerName.trim() },
    });

    return {
      id: result.signature.id,
      quoteStatus: result.quote.status,
      signedAt: result.quote.signedAt!,
    };
  }
}
