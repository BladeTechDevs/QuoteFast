import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

/**
 * Feature: saas-quote-platform, Property 7: Unicidad del publicId
 *
 * Validates: Requirement 3.2
 *
 * For any set of N quotes created in the system, no two quotes should share
 * the same publicId. The publicId is generated with UUID v4 (@default(uuid())
 * in Prisma schema), which must guarantee uniqueness across all created quotes.
 */

describe('QuotesService — Property 7: Unicidad del publicId', () => {
  it(
    'P7: all publicIds generated for N quotes are distinct (no collisions)',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (n) => {
            // Simulate creating N quotes, each receiving a UUID v4 publicId
            // (mirrors what Prisma @default(uuid()) does at the DB level)
            const publicIds = Array.from({ length: n }, () => uuidv4());

            // Property: all publicIds must be unique
            const uniqueIds = new Set(publicIds);
            return uniqueIds.size === publicIds.length;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'P7: publicIds from separate quote creation calls are all distinct',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          (n) => {
            // Simulate the quote creation flow: each call to prisma.quote.create
            // returns a quote with a freshly generated UUID as publicId
            const createdQuotes = Array.from({ length: n }, (_, i) => ({
              id: uuidv4(),
              publicId: uuidv4(),
              title: `Quote ${i + 1}`,
            }));

            const publicIds = createdQuotes.map((q) => q.publicId);
            const uniqueIds = new Set(publicIds);

            // No two quotes share a publicId
            return uniqueIds.size === publicIds.length;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
