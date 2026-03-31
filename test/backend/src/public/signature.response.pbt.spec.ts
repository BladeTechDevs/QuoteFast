import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteStatus } from '@prisma/client';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Property-Based Tests for Signature API Response Structure
 * 
 * This test suite validates Property 9 from the electronic-signature design document.
 * It uses fast-check to generate random signature data and verify that API responses
 * contain complete signature data (id, quoteStatus, signedAt).
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
 * Generator for signable quote statuses
 */
const signableStatus = fc.constantFrom(QuoteStatus.SENT, QuoteStatus.VIEWED);

/**
 * Generator for complete valid signature data
 */
const validSignatureData = fc.record({
  signerName: validSignerName,
  signatureImage: validSignatureImage,
  ipAddress: validIpAddress,
  userAgent: validUserAgent,
  initialStatus: signableStatus,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate UUID format (v4)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if a timestamp is recent (within last 5 seconds)
 */
function isRecentTimestamp(timestamp: Date): boolean {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  return diff >= 0 && diff <= 5000; // Within 5 seconds
}

// ============================================================================
// Test Suite
// ============================================================================

describe('SignatureService — Response Structure Property-Based Tests', () => {
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
   * Feature: electronic-signature, Property 9: Response Contains Complete Signature Data
   * 
   * For any successful signature, the response should contain a valid signature ID (UUID format),
   * the quote status (SIGNED), and a signedAt timestamp.
   * 
   * **Validates: Requirements 7.2, 7.3, 7.4**
   */
  it('P9: response contains complete signature data for all successful signatures', async () => {
    await fc.assert(
      fc.asyncProperty(validSignatureData, async (data) => {
        jest.clearAllMocks();

        const now = new Date();
        const mockQuote = {
          id: 'quote-uuid-1',
          publicId: 'public-uuid-1',
          status: data.initialStatus,
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
          viewedAt: data.initialStatus === QuoteStatus.VIEWED ? new Date() : null,
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
          id: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789', // Valid UUID v4
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
        const response = await service.signQuote({
          publicId: mockQuote.publicId,
          signerName: data.signerName,
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Verify response structure
        // 1. Response should have an 'id' field
        const hasId = 'id' in response;

        // 2. The 'id' should be a valid UUID
        const idIsValidUUID = typeof response.id === 'string' && isValidUUID(response.id);

        // 3. Response should have a 'quoteStatus' field
        const hasQuoteStatus = 'quoteStatus' in response;

        // 4. The 'quoteStatus' should be ACCEPTED
        const statusIsAccepted = response.quoteStatus === QuoteStatus.ACCEPTED;

        // 5. Response should have a 'signedAt' field
        const hasSignedAt = 'signedAt' in response;

        // 6. The 'signedAt' should be a Date object
        const signedAtIsDate = response.signedAt instanceof Date;

        // 7. The 'signedAt' timestamp should be recent (within last 5 seconds)
        const signedAtIsRecent = signedAtIsDate && isRecentTimestamp(response.signedAt);

        return (
          hasId &&
          idIsValidUUID &&
          hasQuoteStatus &&
          statusIsAccepted &&
          hasSignedAt &&
          signedAtIsDate &&
          signedAtIsRecent
        );
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 9 (Edge Case): Response structure with minimal data
   * 
   * When signing with only required fields (no IP address or user agent), the response
   * should still contain complete signature data with the same structure.
   * 
   * **Validates: Requirements 7.2, 7.3, 7.4**
   */
  it('P9: response contains complete signature data with minimal input', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSignerName,
        validSignatureImage,
        signableStatus,
        async (signerName, signatureImage, initialStatus) => {
          jest.clearAllMocks();

          const now = new Date();
          const mockQuote = {
            id: 'quote-uuid-2',
            publicId: 'public-uuid-2',
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
            id: 'b2c3d4e5-f6a7-4890-b123-c4d5e6f7a890', // Valid UUID v4
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
          const response = await service.signQuote({
            publicId: mockQuote.publicId,
            signerName,
            signatureImage,
          });

          // Verify response structure (same checks as main property)
          const hasId = 'id' in response;
          const idIsValidUUID = typeof response.id === 'string' && isValidUUID(response.id);
          const hasQuoteStatus = 'quoteStatus' in response;
          const statusIsAccepted = response.quoteStatus === QuoteStatus.ACCEPTED;
          const hasSignedAt = 'signedAt' in response;
          const signedAtIsDate = response.signedAt instanceof Date;
          const signedAtIsRecent = signedAtIsDate && isRecentTimestamp(response.signedAt);

          return (
            hasId &&
            idIsValidUUID &&
            hasQuoteStatus &&
            statusIsAccepted &&
            hasSignedAt &&
            signedAtIsDate &&
            signedAtIsRecent
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 9 (Completeness): Response contains only expected fields
   * 
   * The response should contain exactly the three expected fields (id, quoteStatus, signedAt)
   * and no additional fields. This ensures the API contract is stable and predictable.
   * 
   * **Validates: Requirements 7.2, 7.3, 7.4**
   */
  it('P9: response contains exactly the expected fields', async () => {
    await fc.assert(
      fc.asyncProperty(validSignatureData, async (data) => {
        jest.clearAllMocks();

        const now = new Date();
        const mockQuote = {
          id: 'quote-uuid-3',
          publicId: 'public-uuid-3',
          status: data.initialStatus,
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
          viewedAt: data.initialStatus === QuoteStatus.VIEWED ? new Date() : null,
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
          id: 'c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901',
          quoteId: mockQuote.id,
          signerName: data.signerName.trim(),
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
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

        const response = await service.signQuote({
          publicId: mockQuote.publicId,
          signerName: data.signerName,
          signatureImage: data.signatureImage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });

        // Verify response has exactly 3 fields
        const responseKeys = Object.keys(response);
        const hasExactlyThreeFields = responseKeys.length === 3;

        // Verify the three fields are the expected ones
        const hasExpectedFields =
          responseKeys.includes('id') &&
          responseKeys.includes('quoteStatus') &&
          responseKeys.includes('signedAt');

        return hasExactlyThreeFields && hasExpectedFields;
      }),
      { numRuns: 100 },
    );
  });
});


// ============================================================================
// Feature: advanced-calculator — Property 5: internalCost excluded from public response
// ============================================================================

import { PublicQuotesService } from './public-quotes.service';
import { TrackingService as _TrackingService } from '../tracking/tracking.service';
import { SqsService } from '../quotes/sqs.service';
import { NotificationsService as _NotificationsService } from '../notifications/notifications.service';

/**
 * Feature: advanced-calculator
 *
 * Property-based tests for the public quote response shape.
 * Validates: Requirement 9.5 — internalCost must never appear in any public API response.
 */

/** Generator for arbitrary internalCost values (including edge cases) */
const internalCostArb = fc.oneof(
  fc.constant(0),
  fc.float({ min: Math.fround(0.01), max: Math.fround(99999), noNaN: true }),
  fc.constant(999999.99),
);

/** Generator for a single quote item with arbitrary internalCost */
const quoteItemWithInternalCostArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 255 }), { nil: null }),
  quantity: fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
  unitPrice: fc.float({ min: Math.fround(1), max: Math.fround(10000), noNaN: true }),
  discount: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  taxRate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  internalCost: internalCostArb,
  total: fc.float({ min: Math.fround(0), max: Math.fround(100000), noNaN: true }),
  order: fc.integer({ min: 0, max: 100 }),
});

/** Builds a minimal mock quote with the given items */
function buildMockQuote(items: Array<Record<string, unknown>>) {
  return {
    publicId: 'pub-test-id',
    title: 'Test Quote',
    status: QuoteStatus.SENT,
    currency: 'USD',
    items: items.map((item) => ({
      ...item,
      quantity: { toNumber: () => item.quantity } as unknown as import('@prisma/client').Prisma.Decimal,
      unitPrice: { toNumber: () => item.unitPrice } as unknown as import('@prisma/client').Prisma.Decimal,
      discount: { toNumber: () => item.discount } as unknown as import('@prisma/client').Prisma.Decimal,
      taxRate: { toNumber: () => item.taxRate } as unknown as import('@prisma/client').Prisma.Decimal,
      internalCost: { toNumber: () => item.internalCost } as unknown as import('@prisma/client').Prisma.Decimal,
      total: { toNumber: () => item.total } as unknown as import('@prisma/client').Prisma.Decimal,
    })),
    subtotal: { toNumber: () => 0 } as unknown as import('@prisma/client').Prisma.Decimal,
    taxRate: { toNumber: () => 0 } as unknown as import('@prisma/client').Prisma.Decimal,
    taxAmount: { toNumber: () => 0 } as unknown as import('@prisma/client').Prisma.Decimal,
    discount: { toNumber: () => 0 } as unknown as import('@prisma/client').Prisma.Decimal,
    total: { toNumber: () => 0 } as unknown as import('@prisma/client').Prisma.Decimal,
    notes: null,
    terms: null,
    validUntil: null,
    pdfUrl: null,
    user: { name: 'Test User', company: null },
    client: null,
    signature: null,
  };
}

describe('PublicQuotesService — internalCost exclusion (advanced-calculator PBT)', () => {
  let publicQuotesService: PublicQuotesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicQuotesService,
        {
          provide: PrismaService,
          useValue: {
            quote: { findUnique: jest.fn() },
          },
        },
        {
          provide: TrackingService,
          useValue: { registerEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SqsService,
          useValue: { enqueue: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: _NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    publicQuotesService = module.get<PublicQuotesService>(PublicQuotesService);
    prisma = module.get(PrismaService);
  });

  /**
   * Feature: advanced-calculator, Property 5: internalCost excluded from public response
   *
   * For any collection of items with arbitrary internalCost values, the public quote
   * response must not contain the `internalCost` key on any item.
   *
   * Validates: Requirement 9.5
   */
  it('P5: internalCost never appears in public quote response items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(quoteItemWithInternalCostArb, { minLength: 1, maxLength: 10 }),
        async (items) => {
          jest.clearAllMocks();

          (prisma.quote.findUnique as jest.Mock).mockResolvedValue(
            buildMockQuote(items),
          );

          const result = await publicQuotesService.findByPublicId('pub-test-id');

          // Feature: advanced-calculator, Property 5: internalCost excluded from public response
          return result.items.every(
            (item) => !Object.prototype.hasOwnProperty.call(item, 'internalCost'),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Feature: advanced-calculator, Property 5 (edge case): internalCost absent even when non-zero
   *
   * Specifically targets non-zero internalCost values to ensure the exclusion is not
   * accidentally relying on falsy-value filtering.
   */
  it('P5: internalCost absent from public response even when value is non-zero', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          quoteItemWithInternalCostArb.filter((item) => (item.internalCost as number) > 0),
          { minLength: 1, maxLength: 10 },
        ),
        async (items) => {
          jest.clearAllMocks();

          (prisma.quote.findUnique as jest.Mock).mockResolvedValue(
            buildMockQuote(items),
          );

          const result = await publicQuotesService.findByPublicId('pub-test-id');

          // Feature: advanced-calculator, Property 5: internalCost excluded from public response
          return result.items.every(
            (item) => !Object.prototype.hasOwnProperty.call(item, 'internalCost'),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
