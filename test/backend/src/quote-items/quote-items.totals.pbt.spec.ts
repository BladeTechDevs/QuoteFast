import * as fc from 'fast-check';
import { calculateItemTotal, calculateQuoteTotals } from '../quotes/utils/calculate-totals';

/**
 * Feature: advanced-calculator
 *
 * Property-based tests for the calculation utility.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

// ─── generators ─────────────────────────────────────────────────────────────

/**
 * A valid item: quantity ≥ 0, unitPrice ≥ 0, discount ∈ [0, qty×price], taxRate ∈ [0,100]
 * We generate a discountRatio ∈ [0,1] and compute discount = ratio × (qty × price)
 * to avoid passing non-32-bit-float values to fc.float's max constraint.
 */
const validItemArb = fc
  .record({
    quantity: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
    unitPrice: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
    taxRate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    discountRatio: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  })
  .map(({ quantity, unitPrice, taxRate, discountRatio }) => ({
    quantity,
    unitPrice,
    taxRate,
    discount: discountRatio * quantity * unitPrice,
  }));

/** A valid quote-level taxRate ∈ [0,100] and discount ≥ 0 */
const quoteLevelArb = fc.record({
  quoteTaxRate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  quoteDiscount: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
});

// ─── test suite ─────────────────────────────────────────────────────────────

describe('calculateItemTotal / calculateQuoteTotals — PBT', () => {
  // Feature: advanced-calculator, Property 1: item total non-negative
  it('P1: item.total ≥ 0 for all valid inputs', () => {
    fc.assert(
      fc.property(validItemArb, (item) => {
        // Feature: advanced-calculator, Property 1: item total non-negative
        const total = calculateItemTotal(item);
        return total >= 0;
      }),
      { numRuns: 1000 },
    );
  });

  // Feature: advanced-calculator, Property 2: subtotal equals sum of item totals
  it('P2: quote.subtotal = Σ(item.total)', () => {
    fc.assert(
      fc.property(
        fc.array(validItemArb, { minLength: 0, maxLength: 20 }),
        quoteLevelArb,
        (items, { quoteTaxRate, quoteDiscount }) => {
          // Feature: advanced-calculator, Property 2: subtotal equals sum of item totals
          const result = calculateQuoteTotals(items, quoteTaxRate, quoteDiscount);
          const expectedSubtotal = items.reduce(
            (sum, item) => sum + calculateItemTotal(item),
            0,
          );
          return Math.abs(result.subtotal - expectedSubtotal) < 0.0001;
        },
      ),
      { numRuns: 500 },
    );
  });

  // Feature: advanced-calculator, Property 3: backward compatibility
  it('P3: items with discount=0, taxRate=0 produce item.total = quantity × unitPrice', () => {
    fc.assert(
      fc.property(
        fc.record({
          quantity: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
          unitPrice: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
        }),
        ({ quantity, unitPrice }) => {
          // Feature: advanced-calculator, Property 3: backward compatibility
          const total = calculateItemTotal({ quantity, unitPrice, discount: 0, taxRate: 0 });
          const legacy = quantity * unitPrice;
          return Math.abs(total - legacy) < 0.0001;
        },
      ),
      { numRuns: 1000 },
    );
  });

  // Feature: advanced-calculator, Property 4: quote total formula
  it('P4: quote.total = subtotal + taxAmount - discount', () => {
    fc.assert(
      fc.property(
        fc.array(validItemArb, { minLength: 0, maxLength: 20 }),
        quoteLevelArb,
        (items, { quoteTaxRate, quoteDiscount }) => {
          // Feature: advanced-calculator, Property 4: quote total formula
          const result = calculateQuoteTotals(items, quoteTaxRate, quoteDiscount);
          const expected = result.subtotal + result.taxAmount - quoteDiscount;
          return Math.abs(result.total - expected) < 0.0001;
        },
      ),
      { numRuns: 500 },
    );
  });
});
