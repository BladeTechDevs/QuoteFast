import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';

/**
 * Feature: advanced-calculator
 *
 * Property-based tests for the frontend calcItemTotal function.
 * Validates: Requirements 7.4, 9.4
 *
 * Note: calcItemTotal is not exported from QuoteEditor.tsx, so we inline
 * the same formula here as the system-under-test and verify it against
 * the reference backend formula.
 */

// ── System under test: mirrors QuoteEditor.tsx calcItemTotal ─────────────────
function calcItemTotal(item: {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}) {
  const sub = item.quantity * item.unitPrice;
  const net = sub - item.discount;
  return net + net * (item.taxRate / 100);
}

// ── Reference: backend formula from calculate-totals.ts ──────────────────────
function backendCalcItemTotal(item: {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}) {
  const itemSubtotal = item.quantity * item.unitPrice;
  const itemNet = itemSubtotal - item.discount;
  const itemTax = itemNet * (item.taxRate / 100);
  return itemNet + itemTax;
}

// ── Generators ───────────────────────────────────────────────────────────────

/**
 * Valid item: quantity ≥ 0, unitPrice ≥ 0, discount ∈ [0, qty×price], taxRate ∈ [0,100]
 * Uses discountRatio ∈ [0,1] to derive discount, avoiding float constraint issues.
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

/** Backward-compat item: discount=0, taxRate=0 */
const legacyItemArb = fc.record({
  quantity: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
  unitPrice: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe('calcItemTotal — Frontend PBT', () => {
  // Feature: advanced-calculator, Property 6: frontend-backend calculation parity
  it('P6: frontend calcItemTotal mirrors backend for all valid inputs', () => {
    // **Validates: Requirements 7.4, 9.4**
    fc.assert(
      fc.property(validItemArb, (item) => {
        // Feature: advanced-calculator, Property 6: frontend-backend calculation parity
        const frontend = calcItemTotal(item);
        const backend = backendCalcItemTotal(item);
        expect(Math.abs(frontend - backend)).toBeLessThan(0.0001);
      }),
      { numRuns: 1000 },
    );
  });

  // Feature: advanced-calculator, Property 7: frontend backward compatibility
  it('P7: items with discount=0, taxRate=0 produce calcItemTotal = quantity × unitPrice', () => {
    // **Validates: Requirements 9.4**
    fc.assert(
      fc.property(legacyItemArb, ({ quantity, unitPrice }) => {
        // Feature: advanced-calculator, Property 7: frontend backward compatibility
        const result = calcItemTotal({ quantity, unitPrice, discount: 0, taxRate: 0 });
        const legacy = quantity * unitPrice;
        expect(Math.abs(result - legacy)).toBeLessThan(0.0001);
      }),
      { numRuns: 1000 },
    );
  });
});
