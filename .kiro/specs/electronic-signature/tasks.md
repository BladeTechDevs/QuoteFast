# Implementation Plan: Electronic Signature

## Overview

This plan implements the electronic signature feature for QuoteFast, enabling clients to digitally sign quotes from the public view. The implementation includes database schema changes, a new SignatureService, validation logic, public API endpoint, tracking integration, and comprehensive testing with both unit tests and property-based tests using fast-check.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Add SIGNED status to QuoteStatus enum and QUOTE_SIGNED to TrackingEventType enum
    - Update Prisma schema with new enum values
    - _Requirements: 4.1, 5.1_
  
  - [x] 1.2 Create Signature model in Prisma schema
    - Add Signature model with all fields (id, quoteId, signerName, signatureImage, ipAddress, userAgent, signedAt, createdAt, updatedAt)
    - Add one-to-one relation to Quote model
    - Add signedAt field to Quote model
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 1.3 Generate and run Prisma migration
    - Run `npx prisma migrate dev --name add-signature-model`
    - Verify migration creates Signature table and updates enums
    - _Requirements: 3.1_

- [x] 2. Create SignQuoteDto for request validation
  - [x] 2.1 Implement SignQuoteDto class with class-validator decorators
    - Add signerName field with @IsString, @IsNotEmpty, @MaxLength(255), @Transform(trim)
    - Add signatureImage field with @IsString, @IsNotEmpty, @Matches for data URI format
    - Create in src/public/dto/sign-quote.dto.ts
    - _Requirements: 2.2, 2.3, 2.4, 6.1_

- [x] 3. Implement SignatureService with validation methods
  - [x] 3.1 Create SignatureService class with dependency injection
    - Inject PrismaService, QuotesService, TrackingService
    - Create in src/public/signature.service.ts
    - _Requirements: 1.4_
  
  - [x] 3.2 Implement validateSignerName method
    - Validate name is not empty after trim
    - Validate name length ≤ 255 characters
    - Throw BadRequestException for invalid names
    - _Requirements: 2.3, 6.1, 6.2, 6.5_
  
  - [x] 3.3 Implement validateSignatureImage method
    - Validate base64 data URI format with regex
    - Validate MIME type is image/png, image/jpeg, image/jpg, or image/webp
    - Decode base64 and validate size ≤ 5MB
    - Throw BadRequestException for invalid images
    - _Requirements: 2.4, 6.3, 6.4_
  
  - [x] 3.4 Implement signQuote method
    - Fetch quote by publicId, throw NotFoundException if not found
    - Validate quote status is SENT or VIEWED, throw ConflictException otherwise
    - Call validateSignerName and validateSignatureImage
    - Use Prisma transaction to create/update signature and update quote status to SIGNED
    - Set quote.signedAt timestamp
    - Call TrackingService to register QUOTE_SIGNED event with metadata
    - Return SignatureResponse with id, quoteStatus, signedAt
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 10.1, 10.2, 10.3_

- [x] 3.5 Write unit tests for SignatureService
    - Test happy path: sign SENT quote, sign VIEWED quote
    - Test validation edge cases: empty name, whitespace name, 255-char name, 256-char name, invalid image format, oversized image
    - Test state validation: attempt to sign DRAFT, ACCEPTED, REJECTED, EXPIRED quotes
    - Test idempotence: sign already SIGNED quote (should replace signature)
    - Test error handling: quote not found, database errors
    - Test integration: verify PrismaService and TrackingService calls
    - _Requirements: 1.3, 2.3, 2.4, 2.5, 3.7, 4.1, 4.2, 6.1, 6.2, 6.3, 6.4, 10.1, 10.2, 10.3_

- [x] 4. Add signQuote endpoint to PublicController
  - [x] 4.1 Inject SignatureService into PublicController
    - Add SignatureService to constructor
    - _Requirements: 1.4_
  
  - [x] 4.2 Implement POST /public/quotes/:publicId/sign endpoint
    - Add @Post(':publicId/sign') route handler
    - Extract publicId from @Param
    - Validate request body with SignQuoteDto
    - Extract IP address from request.ip
    - Extract user-agent from request.headers['user-agent']
    - Call signatureService.signQuote with all parameters
    - Return SignatureResponse
    - _Requirements: 1.4, 2.6, 2.7, 2.8, 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 4.3 Add Swagger documentation decorators
    - Add @ApiOperation with summary 'Sign a quote'
    - Add @ApiResponse for 200 with SignatureResponse type
    - Add @ApiResponse for 400 'Invalid signature data'
    - Add @ApiResponse for 404 'Quote not found'
    - Add @ApiResponse for 409 'Quote not in signable state'
    - Add @ApiBody with SignQuoteDto type and example
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 5. Register SignatureService in PublicModule
  - [x] 5.1 Add SignatureService to PublicModule providers
    - Import SignatureService
    - Add to providers array
    - Ensure QuotesService and TrackingService are available
    - _Requirements: 1.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Write property-based tests for validation logic
  - [x] 7.1 Create signature.validation.pbt.spec.ts
    - Setup fast-check with custom generators for valid/invalid names and images
    - _Requirements: 9.1, 9.4, 9.5_
  
  - [x] 7.2 Write property test for Property 2: Valid Names Are Accepted
    - **Property 2: Valid Names Are Accepted**
    - **Validates: Requirements 2.3, 9.4**
    - Generate random strings (1-255 chars, non-empty after trim)
    - Assert validateSignerName does not throw
    - Run 100 iterations
  
  - [x] 7.3 Write property test for Property 3: Invalid Names Are Rejected
    - **Property 3: Invalid Names Are Rejected**
    - **Validates: Requirements 2.3, 6.1, 6.2, 9.5**
    - Generate invalid names (empty, whitespace-only, >255 chars)
    - Assert validateSignerName throws BadRequestException
    - Run 100 iterations
  
  - [x] 7.4 Write property test for Property 4: Invalid Image Formats Are Rejected
    - **Property 4: Invalid Image Formats Are Rejected**
    - **Validates: Requirements 6.4**
    - Generate invalid image strings (not data URI, wrong MIME type, not base64)
    - Assert validateSignatureImage throws BadRequestException
    - Run 100 iterations
  
  - [x] 7.5 Write property test for Property 5: Validation Failures Return 400 Errors
    - **Property 5: Validation Failures Return 400 Errors**
    - **Validates: Requirements 2.5**
    - Generate invalid signature data (invalid name or invalid image)
    - Call signQuote endpoint
    - Assert response is 400 Bad Request
    - Run 100 iterations

- [x] 8. Write property-based tests for state transitions
  - [x] 8.1 Create signature.state-transitions.pbt.spec.ts
    - Setup test database with quote fixtures
    - _Requirements: 9.2_
  
  - [x] 8.2 Write property test for Property 1: Only Signable States Accept Signatures
    - **Property 1: Only Signable States Accept Signatures**
    - **Validates: Requirements 1.3**
    - Generate quotes with non-signable statuses (DRAFT, ACCEPTED, REJECTED, EXPIRED)
    - Attempt to sign each quote
    - Assert rejection with 400 or 409 error
    - Run 100 iterations
  
  - [x] 8.3 Write property test for Property 7: Successful Signing Transitions State to SIGNED
    - **Property 7: Successful Signing Transitions State to SIGNED**
    - **Validates: Requirements 4.1, 4.2**
    - Generate quotes with signable statuses (SENT, VIEWED)
    - Sign each quote with valid data
    - Assert quote status is SIGNED and signedAt is set
    - Run 100 iterations

- [x] 9. Write property-based tests for data persistence
  - [x] 9.1 Create signature.persistence.pbt.spec.ts
    - Setup test database with cleanup
    - _Requirements: 9.1_
  
  - [x] 9.2 Write property test for Property 6: Signature Data Round-Trip
    - **Property 6: Signature Data Round-Trip**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
    - Generate random valid signature data (name, image, IP, user-agent)
    - Sign a quote with generated data
    - Retrieve signature from database
    - Assert all fields match submitted data
    - Run 100 iterations

- [x] 10. Write property-based tests for tracking events
  - [x] 10.1 Create signature.tracking.pbt.spec.ts
    - Setup test database and mock TrackingService
    - _Requirements: 9.1_
  
  - [x] 10.2 Write property test for Property 8: Tracking Event Created with Complete Metadata
    - **Property 8: Tracking Event Created with Complete Metadata**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    - Generate random valid signature data
    - Sign a quote
    - Query tracking events for QUOTE_SIGNED type
    - Assert event exists with correct quoteId and metadata (IP, user-agent, signer name)
    - Run 100 iterations

- [x] 11. Write property-based tests for API responses
  - [x] 11.1 Create signature.response.pbt.spec.ts
    - Setup test API client
    - _Requirements: 9.1_
  
  - [x] 11.2 Write property test for Property 9: Response Contains Complete Signature Data
    - **Property 9: Response Contains Complete Signature Data**
    - **Validates: Requirements 7.2, 7.3, 7.4**
    - Generate random valid signature data
    - Call signQuote endpoint
    - Assert response contains valid UUID id, SIGNED status, and recent signedAt timestamp
    - Run 100 iterations

- [x] 12. Write property-based tests for idempotence
  - [x] 12.1 Create signature.idempotence.pbt.spec.ts
    - Setup test database with cleanup
    - _Requirements: 9.3_
  
  - [x] 12.2 Write property test for Property 10: Signature Idempotence
    - **Property 10: Signature Idempotence**
    - **Validates: Requirements 3.7, 10.1, 10.2, 10.3**
    - Generate 2-5 different signature data sets
    - Sign the same quote multiple times with different data
    - Assert only one signature record exists
    - Assert signature contains data from last submission
    - Assert quote status remains SIGNED
    - Run 100 iterations

- [-] 13. Write property-based tests for concurrent signatures
  - [x] 13.1 Create signature.concurrency.pbt.spec.ts
    - Setup test database with transaction isolation
    - _Requirements: 9.3_
  
  - [x] 13.2 Write property test for concurrent signature handling
    - **Validates: Requirements 4.3, 4.4**
    - Generate 2-10 concurrent signature requests for same quote
    - Execute all requests simultaneously with Promise.all
    - Assert exactly one request succeeds with 200
    - Assert other requests fail with 409 Conflict
    - Assert only one signature record exists in database
    - Run 50 iterations (lower due to concurrency overhead)

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check with minimum 100 iterations
- All PBT tasks include property number and requirements validation annotations
- Database operations use Prisma transactions for atomicity
- Signature images stored as base64 in PostgreSQL text fields
- Concurrent signature attempts handled with optimistic locking pattern
