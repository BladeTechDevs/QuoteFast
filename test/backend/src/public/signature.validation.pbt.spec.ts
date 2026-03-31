import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as fc from 'fast-check';
import { SignatureService } from './signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Property-Based Tests for Signature Validation
 * 
 * This test suite validates Properties 2, 3, 4, and 5 from the electronic-signature design document.
 * It uses fast-check to generate random inputs and verify validation logic holds across all cases.
 * 
 * Validates: Requirements 9.1, 9.4, 9.5
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
 * Generator for invalid signer names
 * - Empty strings
 * - Whitespace-only strings
 * - Strings exceeding 255 characters
 */
const invalidSignerName = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t\n  '),
  fc.string({ minLength: 256, maxLength: 300 }),
);

/**
 * Generator for valid signature images
 * Uses a small set of real base64-encoded images for performance
 */
const validSignatureImage = fc.constantFrom(
  // 1x1 PNG (red pixel)
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  // 1x1 JPEG
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  // 1x1 JPG (same as JPEG but with jpg MIME type)
  'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  // 1x1 WEBP
  'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
);

/**
 * Generator for invalid signature images
 * - Empty strings
 * - Non-data-URI strings
 * - Wrong MIME types
 * - Missing base64 prefix
 */
const invalidSignatureImage = fc.oneof(
  fc.constant(''),
  fc.constant('not-a-data-uri'),
  fc.constant('data:text/plain;base64,SGVsbG8='),
  fc.constant('data:application/pdf;base64,JVBERi0xLjQK'),
  fc.constant('image/png;base64,iVBORw0KGgo='), // Missing "data:" prefix
  fc.constant('data:image/png,iVBORw0KGgo='), // Missing ";base64"
  fc.string().filter((s) => !s.startsWith('data:image/')),
);

// ============================================================================
// Test Suite
// ============================================================================

describe('SignatureService — Validation Property-Based Tests', () => {
  let service: SignatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        {
          provide: PrismaService,
          useValue: {
            quote: { findUnique: jest.fn() },
            signature: { upsert: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: QuotesService,
          useValue: {},
        },
        {
          provide: TrackingService,
          useValue: { registerEvent: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
  });

  /**
   * Feature: electronic-signature, Property 2: Valid Names Are Accepted
   * 
   * For any string that is non-empty after trimming and has length ≤ 255 characters,
   * the name validation should accept it as a valid signer name.
   * 
   * **Validates: Requirements 9.4**
   */
  it('P2: accepts all valid signer names', async () => {
    await fc.assert(
      fc.asyncProperty(validSignerName, async (name) => {
        // Should not throw
        expect(() => service.validateSignerName(name)).not.toThrow();
        return true;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 3: Invalid Names Are Rejected
   * 
   * For any string that is empty after trimming, contains only whitespace,
   * or exceeds 255 characters, the name validation should reject it with a 400 error.
   * 
   * **Validates: Requirements 9.5**
   */
  it('P3: rejects all invalid signer names', async () => {
    await fc.assert(
      fc.asyncProperty(invalidSignerName, async (name) => {
        try {
          service.validateSignerName(name);
          return false; // Should have thrown
        } catch (err) {
          return err instanceof BadRequestException;
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 4: Invalid Image Formats Are Rejected
   * 
   * For any string that is not a valid base64 data URI with an image MIME type
   * (png, jpeg, jpg, webp), the image validation should reject it with a 400 error.
   * 
   * **Validates: Requirements 9.1**
   */
  it('P4: rejects all invalid signature images', async () => {
    await fc.assert(
      fc.asyncProperty(invalidSignatureImage, async (image) => {
        try {
          service.validateSignatureImage(image);
          return false; // Should have thrown
        } catch (err) {
          return err instanceof BadRequestException;
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: electronic-signature, Property 5: Validation Failures Return 400 Errors
   * 
   * For any invalid signature data (invalid name or invalid image),
   * the service should return a 400 Bad Request error.
   * 
   * This property combines invalid names and invalid images to verify
   * that all validation failures result in BadRequestException.
   * 
   * **Validates: Requirements 9.1, 9.5**
   */
  it('P5: all validation failures throw BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.tuple(invalidSignerName, validSignatureImage),
          fc.tuple(validSignerName, invalidSignatureImage),
          fc.tuple(invalidSignerName, invalidSignatureImage),
        ),
        async ([name, image]) => {
          let nameValidationFailed = false;
          let imageValidationFailed = false;

          try {
            service.validateSignerName(name);
          } catch (err) {
            nameValidationFailed = err instanceof BadRequestException;
          }

          try {
            service.validateSignatureImage(image);
          } catch (err) {
            imageValidationFailed = err instanceof BadRequestException;
          }

          // At least one validation should fail with BadRequestException
          return nameValidationFailed || imageValidationFailed;
        },
      ),
      { numRuns: 100 },
    );
  });
});
