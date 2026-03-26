export interface QuoteTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function calculateQuoteTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  discount: number,
): QuoteTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, total };
}
