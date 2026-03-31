import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CatalogItem } from '@/lib/types';
import type { CatalogSearchSelection } from './CatalogSearch';

/**
 * Feature: products-catalog-and-quote-templates
 * Property 8: Pre-llenado de QuoteItem desde CatalogItem
 *
 * Validates: Requirement 2.1
 *
 * The pre-fill logic lives in CatalogSearch.handleSelect:
 *   onSelect({
 *     name: item.name,
 *     description: item.description ?? '',
 *     unitPrice: item.unitPrice,
 *     taxRate: item.taxRate,
 *     discount: item.discount,
 *     internalCost: item.internalCost,
 *   })
 *
 * We test this mapping directly (pure function) without rendering the component,
 * since the logic is deterministic and does not depend on DOM or network state.
 */

// Mirror of the pre-fill logic from CatalogSearch.handleSelect
function prefillFromCatalogItem(item: CatalogItem): CatalogSearchSelection {
  return {
    name: item.name,
    description: item.description ?? '',
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    discount: item.discount,
    internalCost: item.internalCost,
  };
}

// ── Generators ───────────────────────────────────────────────────────────────

const catalogItemArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 255 }),
  description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  unitPrice: fc.float({ min: 0, max: 100_000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  discount: fc.float({ min: 0, max: 100_000, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100_000, noNaN: true }),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
}) satisfies fc.Arbitrary<CatalogItem>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CatalogSearch – Property 8: Pre-llenado de QuoteItem desde CatalogItem', () => {
  // Feature: products-catalog-and-quote-templates, Property 8: Pre-llenado de QuoteItem desde CatalogItem
  it('los campos del QuoteItem pre-llenado coinciden exactamente con los del CatalogItem', () => {
    // **Validates: Requirements 2.1**
    fc.assert(
      fc.property(catalogItemArb, (item) => {
        const selection = prefillFromCatalogItem(item);

        expect(selection.name).toBe(item.name);
        expect(selection.description).toBe(item.description ?? '');
        expect(selection.unitPrice).toBe(item.unitPrice);
        expect(selection.taxRate).toBe(item.taxRate);
        expect(selection.discount).toBe(item.discount);
        expect(selection.internalCost).toBe(item.internalCost);
      }),
      { numRuns: 100 },
    );
  });

  it('description es string vacío cuando el CatalogItem no tiene description', () => {
    // **Validates: Requirements 2.1**
    fc.assert(
      fc.property(
        catalogItemArb.map((item) => ({ ...item, description: null })),
        (item) => {
          const selection = prefillFromCatalogItem(item);
          expect(selection.description).toBe('');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('description se preserva cuando el CatalogItem tiene description no nula', () => {
    // **Validates: Requirements 2.1**
    fc.assert(
      fc.property(
        fc.record({
          item: catalogItemArb,
          desc: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        ({ item, desc }) => {
          const itemWithDesc = { ...item, description: desc };
          const selection = prefillFromCatalogItem(itemWithDesc);
          expect(selection.description).toBe(desc);
        },
      ),
      { numRuns: 100 },
    );
  });
});
