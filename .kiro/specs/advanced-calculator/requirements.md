# Requirements: Advanced Calculator (Etapa 2)

## Overview

Enhance the QuoteFast quote item system to support per-item discounts, per-item tax rates, internal costs (hidden from clients), and automatic total recalculation. All changes must be backward compatible with existing quotes.

---

## Requirements

### 1. Per-Item Discount

**1.1** Each `QuoteItem` must support an optional `discount` field (Decimal 12,2, default 0).

**1.2** Item discount is applied as an absolute amount subtracted from the item subtotal: `itemSubtotal = quantity × unitPrice - discount`.

**1.3** Item discount must be ≥ 0 and must not exceed the item subtotal (`quantity × unitPrice`).

**1.4** The `discount` field must be optional in create and update DTOs (defaults to 0 if omitted).

**1.5** Existing items without a discount value must default to 0 (backward compatible migration).

---

### 2. Per-Item Tax Rate

**2.1** Each `QuoteItem` must support an optional `taxRate` field (Decimal 5,2, default 0).

**2.2** Item tax is calculated as: `itemTax = itemSubtotal × (taxRate / 100)`.

**2.3** Item `taxRate` must be ≥ 0 and ≤ 100.

**2.4** The `taxRate` field must be optional in create and update DTOs (defaults to 0 if omitted).

**2.5** Existing items without a taxRate must default to 0 (backward compatible migration).

---

### 3. Internal Cost (Margin)

**3.1** Each `QuoteItem` must support an optional `internalCost` field (Decimal 12,2, default 0).

**3.2** `internalCost` represents the internal cost of the item (e.g., supplier cost) and is used to calculate margin. It is never exposed to the client.

**3.3** `internalCost` must be ≥ 0.

**3.4** The `internalCost` field must be optional in create and update DTOs (defaults to 0 if omitted).

**3.5** The `internalCost` field must NOT be included in any public API response (public quote endpoint).

**3.6** Existing items without an internalCost must default to 0 (backward compatible migration).

---

### 4. Updated Item Total Calculation

**4.1** The `QuoteItem.total` field must reflect the full item amount including per-item discount and tax:
```
itemSubtotal = quantity × unitPrice
itemDiscount = discount (absolute)
itemTax      = (itemSubtotal - itemDiscount) × (itemTaxRate / 100)
item.total   = itemSubtotal - itemDiscount + itemTax
```

**4.2** The `item.total` must be recalculated and persisted on every create and update operation.

**4.3** The quote-level `subtotal` must be the sum of all `item.total` values (post-discount, post-item-tax).

**4.4** The quote-level `taxAmount` must be calculated from the quote-level `taxRate` applied to the quote `subtotal`:
```
quote.taxAmount = quote.subtotal × (quote.taxRate / 100)
quote.total     = quote.subtotal + quote.taxAmount - quote.discount
```

**4.5** The `calculateQuoteTotals()` utility must be updated to accept the new item shape and produce correct results.

---

### 5. Recalculate Endpoint

**5.1** A new endpoint `POST /quotes/:id/recalculate` must trigger a full recalculation of all item totals and quote totals for the given quote.

**5.2** The endpoint must be protected (requires JWT auth) and validate ownership.

**5.3** The endpoint must return the updated quote with all items and recalculated totals.

**5.4** The endpoint must reject requests for quotes in terminal states (ACCEPTED, REJECTED, EXPIRED).

---

### 6. Backward Compatibility

**6.1** All new fields (`discount`, `taxRate`, `internalCost`) must have database-level defaults of 0.

**6.2** Existing API consumers that do not send the new fields must continue to work without changes.

**6.3** Existing quote totals must remain correct after migration (items with all-zero new fields produce the same totals as before).

**6.4** The migration must not require downtime (additive columns with defaults).

---

### 7. Frontend — QuoteEditor Updates

**7.1** The `ItemRow` component must display editable fields for `discount` and `taxRate` per item.

**7.2** The `internalCost` field must be displayed in the editor (visible only to the authenticated user, not in the public quote view).

**7.3** The `LocalItem` interface must include `discount`, `taxRate`, and `internalCost` as string fields for form state.

**7.4** The `calcTotals()` frontend function must mirror the updated backend calculation logic.

**7.5** The `TotalsPanel` must show a per-item breakdown when any item has a non-zero discount or taxRate.

**7.6** The public quote view (`/q/[publicId]`) must NOT display `internalCost` for any item.

---

### 8. Frontend — Type System Updates

**8.1** The `QuoteItem` type in `types.ts` must include `discount`, `taxRate`, and `internalCost` fields.

**8.2** The `PublicQuoteItem` type (used in the public view) must NOT include `internalCost`.

---

### 9. Property-Based Tests (PBT)

**9.1** PBT: For any item with `quantity ≥ 0`, `unitPrice ≥ 0`, `discount ≥ 0` (≤ subtotal), `taxRate ∈ [0,100]`, the computed `item.total` must be ≥ 0.

**9.2** PBT: For any collection of items, `quote.subtotal` must equal `Σ(item.total)`.

**9.3** PBT: `quote.total` must equal `quote.subtotal + quote.taxAmount - quote.discount` for all valid inputs.

**9.4** PBT: Items with `discount = 0` and `taxRate = 0` must produce the same `item.total` as the legacy formula (`quantity × unitPrice`), ensuring backward compatibility.

**9.5** PBT: `internalCost` must never appear in any public API response regardless of its value.
