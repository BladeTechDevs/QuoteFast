export interface QuoteTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface ItemForCalculation {
  quantity: number;
  unitPrice: number;
  discount?: number; // absolute discount, default 0
  taxRate?: number;  // per-item tax %, default 0
}

/**
 * Calculates the total for a single item applying per-item discount and tax.
 *
 * net   = quantity × unitPrice - discount
 * total = net + net × (taxRate / 100)
 */
export function calculateItemTotal(item: ItemForCalculation): number {
  const subtotal = item.quantity * item.unitPrice;
  const net = subtotal - (item.discount ?? 0);
  return net + net * ((item.taxRate ?? 0) / 100);
}

export function calculateQuoteTotals(
  items: ItemForCalculation[],
  taxRate: number,
  discount: number,
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, total };
}
