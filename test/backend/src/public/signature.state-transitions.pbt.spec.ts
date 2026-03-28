import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as fc from 'fast-check';
import { QuoteStatus, TrackingEventType } from '@prisma/client';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';

/**
 * Property-Based Tests for Signature State Transitions
 * 
 * This test suite validates Properties 1 and 7 from the electronic-signature design document.
 * It uses fast-check to generate random quote states and verify state transition rules.
 * 
 * Validates: Requirements 9.2
 */

// ============================================================================
// Constants and Generators
// ============================================================================

/**
 * Signable quote statuses - quotes in these states can be signed
 */
const SIGNABLE_STATUSES = [QuoteStatus.SENT, QuoteStatus.VIEWED];

/**
 * Non-signable quote statuses - quotes in these states cannot be signed
 */
const NON_SIGNABLE_STATUSES = [
  QuoteStatus.DRAFT,
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

/**
 * Valid signature image for testing
 */
const VALID_PNG_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ============================================================================
// Test Suite
// ============================================================================

describe('SignatureService — State Transitions Property-Based Tests', () => {
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
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
    prisma = module.get(PrismaService);
    trackingService = module.get(TrackingService);
  });

  /**
   * Feature: electronic-signature, Property 1: Only Signable States Accept Signatures
   * 
   * For any quote with status other than SENT or VIEWED, attempting to sign the quote
   * should result in a rejection error (400 or 409).
   * 
   * **Validates: Requirements 1.3**
   */
  it('P1: only signable states (SENT, VIEWED) accept signatures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NON_SIGNABLE_STATUSES),
        async (status) => {
          jest.clearAllMocks();

          // Mock quote with non-signable status
          (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
            id: 'quote-uuid-1',
            publicId: 'public-uuid-1',
            status,
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
          });

          try {
            await service.signQuote({
              publicId: 'public-uuid-1',
              signerName: 'John Doe',
              signatureImage: VALID_PNG_IMAGE,
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
            });
            return false; // Should have thrown
          } catch (err) {
            // Should throw ConflictException for non-signable states
            return err instanceof ConflictException;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 7: Successful Signing Transitions State to ACCEPTED
   * 
   * For any quote in SENT or VIEWED status, successfully signing the quote should result
   * in the quote status being ACCEPTED and the signedAt timestamp being set to a recent value.
   * 
   * **Validates: Requirements 4.1, 4.2**
   */
  it('P7: successful signing transitions state to ACCEPTED with timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...SIGNABLE_STATUSES),
        fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
        fc.ipV4(),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (initialStatus, signerName, ipAddress, userAgent) => {
          jest.clearAllMocks();

          const now = new Date();
          const mockQuote = {
            id: 'quote-uuid-1',
            publicId: 'public-uuid-1',
            status: initialStatus,
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
            viewedAt: initialStatus === QuoteStatus.VIEWED ? new Date() : null,
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
            acceptedAt: now,
          };

          const mockSignature = {
            id: 'signature-uuid-1',
            quoteId: 'quote-uuid-1',
            signerName: signerName.trim(),
            signatureImage: VALID_PNG_IMAGE,
            ipAddress,
            userAgent,
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

          const result = await service.signQuote({
            publicId: 'public-uuid-1',
            signerName,
            signatureImage: VALID_PNG_IMAGE,
            ipAddress,
            userAgent,
          });

          // Verify the quote status transitioned to ACCEPTED
          const statusCorrect = result.quoteStatus === QuoteStatus.ACCEPTED;

          // Verify signedAt timestamp is set and recent (within last 5 seconds)
          const timestampSet = result.signedAt !== null && result.signedAt !== undefined;
          const timestampRecent =
            timestampSet && Math.abs(result.signedAt.getTime() - now.getTime()) < 5000;

          // Verify tracking event was registered
          const trackingCalled = trackingService.registerEvent.mock.calls.length === 1;
          const trackingCorrect =
            trackingCalled &&
            trackingService.registerEvent.mock.calls[0][0].eventType ===
              TrackingEventType.QUOTE_ACCEPTED &&
            trackingService.registerEvent.mock.calls[0][0].quoteId === mockQuote.id;

          return statusCorrect && timestampSet && timestampRecent && trackingCorrect;
        },
      ),
      { numRuns: 100 },
    );
  });
});
