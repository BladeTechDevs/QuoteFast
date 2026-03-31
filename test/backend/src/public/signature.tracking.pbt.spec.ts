import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Property-Based Tests for Signature Tracking Events
 * 
 * This test suite validates Property 8 from the electronic-signature design document.
 * It uses fast-check to generate random signature data and verify that tracking events
 * are created with complete metadata when quotes are signed.
 * 
 * Validates: Requirements 9.1
 */

// ============================================================================
// Custom Generators
// ============================================================================

/**
 * Generator for valid signer names
 * - Non-empty after trimming
 * - Length ≤ 255 characters
 */
const validSignerName = fc
  .string({ minLength: 1, maxLength: 255 })
  .filter((s) => s.trim().length > 0);

/**
 * Generator for valid signature images
 * Uses a small set of real base64-encoded images for performance
 */
const validSignatureImage = fc.constantFrom(
  // 1x1 PNG (red pixel)
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  // 1x1 JPEG
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  // 1x1 JPG
  'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  // 1x1 WEBP
  'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
);

/**
 * Generator for valid IP addresses (IPv4)
 */
const validIpAddress = fc.ipV4();

/**
 * Generator for valid user agent strings
 */
const validUserAgent = fc.oneof(
  fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
  fc.constant('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
  fc.constant('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'),
  fc.string({ minLength: 10, maxLength: 200 }),
);

/**
 * Generator for complete valid signature data
 */
const validSignatureData = fc.record({
  signerName: validSignerName,
  signatureImage: validSignatureImage,
  ipAddress: validIpAddress,
  userAgent: validUserAgent,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('SignatureService — Tracking Events Property-Based Tests', () => {
  let service: SignatureService;
  let prisma: jest.Mocked<PrismaService>;
  let trackingService: jest.Mocked<TrackingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        {
          provide: PrismaService,
          useValue: {
            quote: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            signature: {
              upsert: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: QuotesService,
          useValue: {},
        },
        {
          provide: TrackingService,
          useValue: {
            registerEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
    prisma = module.get(PrismaService);
    trackingService = module.get(TrackingService);
  });

  /**
   * Feature: electronic-signature, Property 8: Tracking Event Created with Complete Metadata
   * 
   * For any successful signature, a QUOTE_ACCEPTED tracking event should be created with the
   * correct quoteId and metadata containing the IP address, user-agent, and signer name.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
   */
  it('P8: tracking event created with complete metadata for all signatures', async () => {
    await fc.assert(
      fc.asyncProperty(validSignatureData, async (data) => {
        jest.clearAllMocks();

        const now = new Date();
        const mockQuote = {
          id: 'quote-uuid-1',
          publicId: 'public-uuid-1',
          status: QuoteStatus.SENT,
          userId: 'user-uuid-1',
          clientId: null,
          title: 'Test Quote',
          currency: 'USD',
          subtotal: 1000,
          taxRate: 0,
          taxAmount: 0,
          total: 1000,
          discount: 0,
          notes: null,
          terms: null,
          validUntil: null,
          pdfUrl: null,
          sentAt: new Date(),
          viewedAt: null,
          acceptedAt: null,
          rejectedAt: null,
          signedAt: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const signedQuote = {
          ...mockQuote,
          status: QuoteStatus.ACCEPTED,
          signedAt: now,
        };

        const mockSignature = {
          id: 'signature-uuid-1',
          quoteId: mockQuote.id,
          signerName: data.signerName.trim(),
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          signedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        // Mock the database operations
        (prisma.quote.findUnique as jest.Mock).mockResolvedValue(mockQuote);
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          return callback({
            signature: {
              upsert: jest.fn().mockResolvedValue(mockSignature),
            },
            quote: {
              update: jest.fn().mockResolvedValue(signedQuote),
            },
          });
        });

        // Sign the quote with the generated data
        await service.signQuote({
          publicId: mockQuote.publicId,
          signerName: data.signerName,
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Verify tracking event was registered
        const trackingCalled = trackingService.registerEvent.mock.calls.length === 1;
        if (!trackingCalled) {
          return false;
        }

        const eventCall = trackingService.registerEvent.mock.calls[0][0];

        // Verify event type is QUOTE_ACCEPTED
        const eventTypeCorrect = eventCall.eventType === TrackingEventType.QUOTE_ACCEPTED;

        // Verify quoteId is correct
        const quoteIdCorrect = eventCall.quoteId === mockQuote.id;

        // Verify IP address is included
        const ipAddressCorrect = eventCall.ipAddress === data.ipAddress;

        // Verify user-agent is included
        const userAgentCorrect = eventCall.userAgent === data.userAgent;

        // Verify metadata contains signer name
        const metadataExists = eventCall.metadata !== null && eventCall.metadata !== undefined;
        const signerNameInMetadata =
          metadataExists && eventCall.metadata.signerName === data.signerName.trim();

        return (
          eventTypeCorrect &&
          quoteIdCorrect &&
          ipAddressCorrect &&
          userAgentCorrect &&
          metadataExists &&
          signerNameInMetadata
        );
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 8 (Edge Case): Tracking event with null optional fields
   * 
   * When IP address and user agent are not provided (null/undefined), the tracking event
   * should still be created with null values for these optional fields, but the signer name
   * should still be present in the metadata.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.5**
   */
  it('P8: tracking event created with null optional fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSignerName,
        validSignatureImage,
        async (signerName, signatureImage) => {
          jest.clearAllMocks();

          const now = new Date();
          const mockQuote = {
            id: 'quote-uuid-2',
            publicId: 'public-uuid-2',
            status: QuoteStatus.VIEWED,
            userId: 'user-uuid-1',
            clientId: null,
            title: 'Test Quote',
            currency: 'USD',
            subtotal: 1000,
            taxRate: 0,
            taxAmount: 0,
            total: 1000,
            discount: 0,
            notes: null,
            terms: null,
            validUntil: null,
            pdfUrl: null,
            sentAt: new Date(),
            viewedAt: new Date(),
            acceptedAt: null,
            rejectedAt: null,
            signedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const signedQuote = {
            ...mockQuote,
            status: QuoteStatus.ACCEPTED,
            signedAt: now,
          };

          const mockSignature = {
            id: 'signature-uuid-2',
            quoteId: mockQuote.id,
            signerName: signerName.trim(),
            signatureImage,
            ipAddress: null,
            userAgent: null,
            signedAt: now,
            createdAt: now,
            updatedAt: now,
          };

          (prisma.quote.findUnique as jest.Mock).mockResolvedValue(mockQuote);
          (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
            return callback({
              signature: {
                upsert: jest.fn().mockResolvedValue(mockSignature),
              },
              quote: {
                update: jest.fn().mockResolvedValue(signedQuote),
              },
            });
          });

          // Sign without providing ipAddress and userAgent
          await service.signQuote({
            publicId: mockQuote.publicId,
            signerName,
            signatureImage,
          });

          // Verify tracking event was registered
          const trackingCalled = trackingService.registerEvent.mock.calls.length === 1;
          if (!trackingCalled) {
            return false;
          }

          const eventCall = trackingService.registerEvent.mock.calls[0][0];

          // Verify event type and quoteId
          const eventTypeCorrect = eventCall.eventType === TrackingEventType.QUOTE_ACCEPTED;
          const quoteIdCorrect = eventCall.quoteId === mockQuote.id;

          // Verify optional fields are undefined (not provided)
          const ipAddressUndefined = eventCall.ipAddress === undefined;
          const userAgentUndefined = eventCall.userAgent === undefined;

          // Verify metadata still contains signer name
          const metadataExists = eventCall.metadata !== null && eventCall.metadata !== undefined;
          const signerNameInMetadata =
            metadataExists && eventCall.metadata.signerName === signerName.trim();

          return (
            eventTypeCorrect &&
            quoteIdCorrect &&
            ipAddressUndefined &&
            userAgentUndefined &&
            metadataExists &&
            signerNameInMetadata
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

