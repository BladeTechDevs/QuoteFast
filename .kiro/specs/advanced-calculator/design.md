# Design: Advanced Calculator (Etapa 2)

## Overview

This document describes the technical design for adding per-item discounts, per-item tax rates, and internal costs to QuoteFast quote items, along with a recalculate endpoint and frontend editor updates.

---

## Database Changes

### QuoteItem — New Fields

```prisma
model QuoteItem {
  // ... existing fields ...
  discount      Decimal  @default(0) @db.Decimal(12, 2)  // absolute discount per item
  taxRate       Decimal  @default(0) @db.Decimal(5, 2)   // per-item tax %
  internalCost  Decimal  @default(0) @db.Decimal(12, 2)  // internal cost (hidden from client)
}
```

### Migration Strategy

Additive migration — no downtime required:
```sql
ALTER TABLE "QuoteItem"
  ADD COLUMN "discount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate"      DECIMAL(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN "internalCost" DECIMAL(12,2) NOT NULL DEFAULT 0;
```

Existing rows automatically get `0` for all new fields, preserving current totals.

---

## Updated Calculation Logic

### Item-Level

```
itemSubtotal = quantity × unitPrice
itemNet      = itemSubtotal - discount          (discount is absolute)
itemTax      = itemNet × (item.taxRate / 100)
item.total   = itemNet + itemTax
```

### Quote-Level (unchanged structure, updated inputs)

```
quote.subtotal  = Σ(item.total)                 // sum of post-discount, post-item-tax totals
quote.taxAmount = quote.subtotal × (quote.taxRate / 100)
quote.total     = quote.subtotal + quote.taxAmount - quote.discount
```

### Updated `calculateQuoteTotals()` Signature

```typescript
interface ItemForCalculation {
  quantity: number;
  unitPrice: number;
  discount?: number;   // default 0
  taxRate?: number;    // default 0
}

export function calculateQuoteTotals(
  items: ItemForCalculation[],
  quoteTaxRate: number,
  quoteDiscount: number,
): QuoteTotals
```

---

## Backend Changes

### 1. Prisma Schema (`schema.prisma`)
Add three fields to `QuoteItem` with defaults.

### 2. Migration
New migration file: `20260327_add_advanced_calculator_fields`

### 3. DTOs

**`CreateQuoteItemDto`** — add optional fields:
```typescript
@IsOptional() @Min(0) discount?: number;      // default 0
@IsOptional() @Min(0) @Max(100) taxRate?: number;  // default 0
@IsOptional() @Min(0) internalCost?: number;  // default 0
```

**`UpdateQuoteItemDto`** — same optional fields.

### 4. `quote-items.service.ts`
- Update `create()` and `update()` to persist new fields.
- Update `recalculateTotals()` to use new item shape.

### 5. `calculate-totals.ts`
- Update `calculateQuoteTotals()` to accept `ItemForCalculation[]`.
- Add `calculateItemTotal()` helper for per-item calculation.

### 6. New Recalculate Endpoint

**`quotes.controller.ts`** — add:
```
POST /quotes/:id/recalculate
```

**`quotes.service.ts`** — add `recalculate(userId, quoteId)`:
- Fetch quote + items, verify ownership and non-terminal state.
- Recalculate each `item.total` using new formula.
- Recalculate quote totals.
- Return updated quote with items.

### 7. Public API — `internalCost` Exclusion

The public quote response must exclude `internalCost`. This is handled by omitting it from the public response shape in `public-quotes.service.ts`.

---

## Frontend Changes

### 1. `types.ts`

```typescript
export interface QuoteItem {
  id: string;
  quoteId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;       // NEW
  taxRate: number;        // NEW
  internalCost: number;   // NEW
  total: number;
  order: number;
}

// Public view — no internalCost
export interface PublicQuoteItem {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
  order: number;
}
```

### 2. `QuoteEditor.tsx`

**`LocalItem` interface** — add string fields:
```typescript
interface LocalItem {
  // ... existing ...
  discount: string;
  taxRate: string;
  internalCost: string;
}
```

**`calcTotals()` frontend function** — updated to mirror backend:
```typescript
function calcItemTotal(item: { quantity: number; unitPrice: number; discount: number; taxRate: number }) {
  const sub = item.quantity * item.unitPrice;
  const net = sub - item.discount;
  return net + net * (item.taxRate / 100);
}

function calcTotals(items, quoteTaxRate, quoteDiscount) {
  const subtotal = items.reduce((s, i) => s + calcItemTotal(toNumbers(i)), 0);
  const taxAmount = subtotal * (quoteTaxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount - quoteDiscount };
}
```

**`ItemRow` component** — add three new columns: Descuento, Impuesto (%), Costo Interno.

**`TotalsPanel`** — no structural changes needed; subtotal already reflects item-level calculations.

### 3. Public Quote Page (`/q/[publicId]`)

The `PublicQuoteItem` type is used here — `internalCost` is simply not present in the type or rendered.

---

## API Contract

### `POST /quotes/:id/recalculate`

**Request:** No body required.

**Response `200`:**
```json
{
  "id": "...",
  "subtotal": 1000.00,
  "taxAmount": 160.00,
  "total": 1160.00,
  "items": [
    {
      "id": "...",
      "name": "Item A",
      "quantity": 2,
      "unitPrice": 500,
      "discount": 0,
      "taxRate": 0,
      "internalCost": 300,
      "total": 1000.00
    }
  ]
}
```

**Errors:**
- `404` — quote not found or not owned by user
- `422` — quote is in a terminal state

---

## Testing Strategy

### Backend PBT (`quote-items.totals.pbt.spec.ts`)
- Property: item.total ≥ 0 for all valid inputs
- Property: quote.subtotal = Σ(item.total)
- Property: backward compat (discount=0, taxRate=0 → same as legacy)

### Backend Unit (`quote-items.service.pbt.spec.ts`)
- Create/update with new fields persists correctly
- Recalculate endpoint returns updated totals
- internalCost excluded from public response

### Frontend PBT
- calcItemTotal mirrors backend for all valid inputs
- calcTotals produces consistent subtotal/tax/total
