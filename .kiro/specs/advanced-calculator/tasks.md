# Implementation Plan: Advanced Calculator (Etapa 2)

## Overview

Add per-item discounts, per-item tax rates, and internal costs to QuoteItem. Update the calculation engine, expose a recalculate endpoint, and update the frontend editor. All changes are backward compatible.

---

## Tasks

### Backend

- [x] 1. Database migration — add new QuoteItem fields
  - Create migration `20260327_add_advanced_calculator_fields`
  - Add `discount DECIMAL(12,2) NOT NULL DEFAULT 0` to `QuoteItem`
  - Add `taxRate DECIMAL(5,2) NOT NULL DEFAULT 0` to `QuoteItem`
  - Add `internalCost DECIMAL(12,2) NOT NULL DEFAULT 0` to `QuoteItem`
  - Update `test/backend/prisma/schema.prisma` to add the three fields with defaults
  - _Requirements: 1.1, 1.5, 2.1, 2.5, 3.1, 3.6, 6.1, 6.4_

- [x] 2. Update `calculateQuoteTotals()` utility
  - Update `ItemForCalculation` interface to include optional `discount` and `taxRate` (default 0)
  - Add `calculateItemTotal()` helper: `net = qty×price - discount; total = net + net×(taxRate/100)`
  - Update `calculateQuoteTotals()` to use `calculateItemTotal()` per item
  - Ensure items with `discount=0, taxRate=0` produce identical results to legacy formula
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.3_

- [x] 3. Write PBT for calculation utility
  - **Property 1: item.total ≥ 0 for all valid inputs**
    - Generate: quantity ≥ 0, unitPrice ≥ 0, discount ∈ [0, qty×price], taxRate ∈ [0,100]
    - Verify: calculateItemTotal() ≥ 0
    - Tag: `// Feature: advanced-calculator, Property 1: item total non-negative`
  - **Property 2: quote.subtotal = Σ(item.total)**
    - Generate: arbitrary arrays of valid items
    - Verify: subtotal equals sum of individual item totals
    - Tag: `// Feature: advanced-calculator, Property 2: subtotal equals sum of item totals`
  - **Property 3: backward compatibility**
    - Generate: items with discount=0, taxRate=0
    - Verify: item.total = quantity × unitPrice (legacy formula)
    - Tag: `// Feature: advanced-calculator, Property 3: backward compatibility`
  - **Property 4: quote.total = subtotal + taxAmount - discount**
    - Generate: arbitrary valid quote inputs
    - Verify: total formula holds
    - Tag: `// Feature: advanced-calculator, Property 4: quote total formula`
  - File: `test/backend/src/quote-items/quote-items.totals.pbt.spec.ts`
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 4. Update `CreateQuoteItemDto` and `UpdateQuoteItemDto`
  - Add optional `discount?: number` with `@Min(0)` to both DTOs
  - Add optional `taxRate?: number` with `@Min(0) @Max(100)` to both DTOs
  - Add optional `internalCost?: number` with `@Min(0)` to both DTOs
  - _Requirements: 1.4, 2.3, 2.4, 3.3, 3.4, 6.2_

- [x] 5. Update `QuoteItemsService`
  - Update `create()` to persist `discount`, `taxRate`, `internalCost` from DTO (default 0)
  - Update `update()` to persist new fields when provided
  - Update `recalculateTotals()` private method to use new `calculateItemTotal()` per item before summing
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Implement `recalculate` endpoint
  - Add `recalculate(userId: string, quoteId: string)` method to `QuotesService`
    - Fetch quote with items, verify ownership, reject terminal states (422)
    - Recalculate each `item.total` using new formula and persist
    - Recalculate quote totals and persist
    - Return updated quote with items
  - Add `POST /quotes/:id/recalculate` route to `QuotesController` with `@UseGuards(JwtAuthGuard)`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Exclude `internalCost` from public API response
  - In `public-quotes.service.ts`, ensure items in the public response do not include `internalCost`
  - Verify the public quote endpoint response shape omits the field
  - _Requirements: 3.2, 3.5, 9.5_

- [x] 8. Write PBT for `internalCost` exclusion from public response
  - **Property 5: internalCost never in public response**
    - Generate: items with arbitrary internalCost values
    - Verify: public quote response items do not contain `internalCost` key
    - Tag: `// Feature: advanced-calculator, Property 5: internalCost excluded from public response`
  - File: `test/backend/src/public/signature.response.pbt.spec.ts` (extend existing) or new file
  - _Requirements: 9.5_

---

### Frontend

- [x] 9. Update `QuoteItem` and `PublicQuoteItem` types in `types.ts`
  - Add `discount: number`, `taxRate: number`, `internalCost: number` to `QuoteItem`
  - Add `discount: number`, `taxRate: number` to `PublicQuoteItem` (no `internalCost`)
  - _Requirements: 8.1, 8.2_

- [x] 10. Update `calcTotals()` and `LocalItem` in `QuoteEditor.tsx`
  - Add `discount: string`, `taxRate: string`, `internalCost: string` to `LocalItem` interface
  - Update `newLocalItem()` to initialize new fields to `'0'`
  - Update `toNumbers()` to parse new fields
  - Add `calcItemTotal()` helper mirroring backend formula
  - Update `calcTotals()` to use `calcItemTotal()` per item
  - _Requirements: 7.3, 7.4_

- [x] 11. Update `ItemRow` component in `QuoteEditor.tsx`
  - Add editable `discount` column (label: "Descuento")
  - Add editable `taxRate` column (label: "Imp. %")
  - Add editable `internalCost` column (label: "Costo interno") — visible only in editor, not in public view
  - _Requirements: 7.1, 7.2_

- [x] 12. Verify public quote page does not render `internalCost`
  - Confirm `PublicQuoteItem` type has no `internalCost`
  - Confirm item rows in `/q/[publicId]` page do not render internal cost column
  - _Requirements: 7.6, 8.2_

- [x] 13. Write frontend PBT for calculation parity
  - **Property 6: frontend calcItemTotal mirrors backend for all valid inputs**
    - Generate: quantity ≥ 0, unitPrice ≥ 0, discount ∈ [0, qty×price], taxRate ∈ [0,100]
    - Verify: frontend result equals backend formula result
    - Tag: `// Feature: advanced-calculator, Property 6: frontend-backend calculation parity`
  - **Property 7: frontend backward compatibility**
    - Generate: items with discount=0, taxRate=0
    - Verify: calcItemTotal = quantity × unitPrice
    - Tag: `// Feature: advanced-calculator, Property 7: frontend backward compatibility`
  - File: `test/frontend/src/components/quotes/QuoteEditor.calc.pbt.test.tsx`
  - _Requirements: 7.4, 9.4_

---

### Documentation

- [x] 14. Update documentation
  - Update `test/docs/database.md` — add new QuoteItem fields to the table
  - Update `test/docs/PLAN-DE-TRABAJO-EXPANSION-MVP.md` — mark Etapa 2 as completed when done
  - _Requirements: all_

---

## Notes

- All new fields default to 0 — no breaking changes to existing API consumers
- `internalCost` is a backend-only field for margin tracking; never sent to public endpoints
- The recalculate endpoint is a convenience tool; normal create/update already recalculates
- Frontend `internalCost` column is only rendered inside the authenticated `QuoteEditor`, never in the public view
- PBT files follow the existing pattern: fast-check generators, tagged with feature name
