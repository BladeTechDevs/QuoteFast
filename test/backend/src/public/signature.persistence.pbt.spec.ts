import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteStatus } from '@prisma/client';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';

/**
 * Property-Based Tests for Signature Data Persistence
 * 
 * This test suite validates Property 6 from the electronic-signature design document.
 * It uses fast-check to generate random signature data and verify that all data
 * persists correctly through round-trip operations (write then read).
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

describe('SignatureService — Persistence Property-Based Tests', () => {
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
              findUnique: jest.fn(),
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
   * Feature: electronic-signature, Property 6: Signature Data Round-Trip
   * 
   * For any valid signature submission (valid name, valid image, valid IP, valid user-agent),
   * after signing a quote, retrieving the signature from the database should return all the
   * submitted data unchanged (name, image, IP, user-agent, and quoteId association).
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   */
  it('P6: signature data persists correctly through round-trip', async () => {
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

        // The signature that will be "stored" in the database
        const storedSignature = {
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
              upsert: jest.fn().mockResolvedValue(storedSignature),
            },
            quote: {
              update: jest.fn().mockResolvedValue(signedQuote),
            },
          });
        });

        // Sign the quote with the generated data
        const result = await service.signQuote({
          publicId: mockQuote.publicId,
          signerName: data.signerName,
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Verify the signature ID is returned
        const hasValidId = result.id === storedSignature.id;

        // Now simulate retrieving the signature from the database
        // In a real scenario, this would be a separate query, but we're testing
        // that the service correctly passes data to Prisma
        const transactionCallback = (prisma.$transaction as jest.Mock).mock.calls[0][0];
        const mockTx = {
          signature: {
            upsert: jest.fn().mockResolvedValue(storedSignature),
          },
          quote: {
            update: jest.fn().mockResolvedValue(signedQuote),
          },
        };
        await transactionCallback(mockTx);

        // Verify the upsert was called with the correct data
        const upsertCall = mockTx.signature.upsert.mock.calls[0][0];

        // Check that all fields match the submitted data
        const nameMatches = upsertCall.create.signerName === data.signerName.trim();
        const imageMatches = upsertCall.create.signatureImage === data.signatureImage;
        const ipMatches = upsertCall.create.ipAddress === data.ipAddress;
        const userAgentMatches = upsertCall.create.userAgent === data.userAgent;
        const quoteIdMatches = upsertCall.create.quoteId === mockQuote.id;

        // Also verify the update clause has the same data (for idempotence)
        const updateNameMatches = upsertCall.update.signerName === data.signerName.trim();
        const updateImageMatches = upsertCall.update.signatureImage === data.signatureImage;
        const updateIpMatches = upsertCall.update.ipAddress === data.ipAddress;
        const updateUserAgentMatches = upsertCall.update.userAgent === data.userAgent;

        return (
          hasValidId &&
          nameMatches &&
          imageMatches &&
          ipMatches &&
          userAgentMatches &&
          quoteIdMatches &&
          updateNameMatches &&
          updateImageMatches &&
          updateIpMatches &&
          updateUserAgentMatches
        );
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 6 (Edge Case): Signature data with null optional fields
   * 
   * When IP address and user agent are not provided (null/undefined), the signature should
   * still persist correctly with null values for these optional fields.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   */
  it('P6: signature data persists correctly with null optional fields', async () => {
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

          const storedSignature = {
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
                upsert: jest.fn().mockResolvedValue(storedSignature),
              },
              quote: {
                update: jest.fn().mockResolvedValue(signedQuote),
              },
            });
          });

          // Sign without providing ipAddress and userAgent
          const result = await service.signQuote({
            publicId: mockQuote.publicId,
            signerName,
            signatureImage,
          });

          const transactionCallback = (prisma.$transaction as jest.Mock).mock.calls[0][0];
          const mockTx = {
            signature: {
              upsert: jest.fn().mockResolvedValue(storedSignature),
            },
            quote: {
              update: jest.fn().mockResolvedValue(signedQuote),
            },
          };
          await transactionCallback(mockTx);

          const upsertCall = mockTx.signature.upsert.mock.calls[0][0];

          // Verify null values are stored correctly
          const ipIsNull = upsertCall.create.ipAddress === null;
          const userAgentIsNull = upsertCall.create.userAgent === null;
          const nameMatches = upsertCall.create.signerName === signerName.trim();
          const imageMatches = upsertCall.create.signatureImage === signatureImage;

          return ipIsNull && userAgentIsNull && nameMatches && imageMatches;
        },
      ),
      { numRuns: 100 },
    );
  });
});

