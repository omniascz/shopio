/**
 * Returns/refunds domain logic — per `17-returns-refunds.md` MVP.
 *
 * Pure helpers (proportional refund math, RULE-RTN-012/013) + the state
 * machine table. DB orchestration lives in `routes/returns.ts`; the math here
 * is unit-tested in isolation.
 *
 * Proportional rule: returning q of Q ordered units refunds
 *   gross_r = floor(G × q / Q), tax_r = floor(T × q / Q), net_r = gross_r − tax_r
 * which reproduces the exact line totals when q = Q (no penny loss on full
 * returns), and never over-refunds on partials.
 */

import type { schema } from '@shopio/db';

type OrderItem = typeof schema.orderItems.$inferSelect;

export const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'rejected', 'cancelled'],
  received: ['refunded'],
  refunded: [],
  rejected: [],
  cancelled: [],
};

export function isValidReturnTransition(from: string, to: string): boolean {
  return (RETURN_TRANSITIONS[from] ?? []).includes(to);
}

export interface ReturnLineComputation {
  quantity: number;
  unitGrossAmount: bigint;
  lineGrossAmount: bigint;
  lineNetAmount: bigint;
  lineTaxAmount: bigint;
  taxClassCode: string;
  taxRateBasisPoints: number;
}

export class ReturnError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Compute the proportional refund snapshot for returning `quantity` units of
 * an order item.
 */
export function computeReturnLine(
  item: Pick<
    OrderItem,
    | 'quantity'
    | 'unitPriceAmount'
    | 'lineTotalAmount'
    | 'lineTaxAmount'
    | 'taxClassCode'
    | 'taxRateBasisPoints'
  >,
  quantity: number,
): ReturnLineComputation {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ReturnError('INVALID_QUANTITY', 'Quantity must be a positive integer');
  }
  if (quantity > item.quantity) {
    throw new ReturnError(
      'QUANTITY_EXCEEDS_ORDERED',
      `Cannot return ${quantity}; only ${item.quantity} ordered`,
    );
  }
  const q = BigInt(quantity);
  const Q = BigInt(item.quantity);
  const gross = (item.lineTotalAmount * q) / Q;
  const tax = (item.lineTaxAmount * q) / Q;
  return {
    quantity,
    unitGrossAmount: item.unitPriceAmount,
    lineGrossAmount: gross,
    lineNetAmount: gross - tax,
    lineTaxAmount: tax,
    taxClassCode: item.taxClassCode,
    taxRateBasisPoints: item.taxRateBasisPoints,
  };
}

/**
 * Proportional shipping refund snapshot from order totals (gross + contained
 * VAT recovered the same way the invoice does it).
 */
export function computeShippingRefund(order: {
  shippingAmount: bigint;
  taxAmount: bigint;
  orderItemTaxSum: bigint;
}): { gross: bigint; net: bigint; tax: bigint } {
  const gross = order.shippingAmount;
  const tax = order.taxAmount - order.orderItemTaxSum;
  return { gross, net: gross - tax, tax };
}

/** RMA number: RMA-{year}-{0000 seq}. */
export function formatReturnNumber(year: number, seq: number): string {
  return `RMA-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Remaining returnable quantity per order item given prior non-dead returns.
 * (rejected/cancelled returns release their quantities back.)
 */
export function returnableQuantity(
  orderedQuantity: number,
  priorReturnedQuantities: { quantity: number; status: string }[],
): number {
  const held = priorReturnedQuantities
    .filter((r) => r.status !== 'rejected' && r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.quantity, 0);
  return Math.max(0, orderedQuantity - held);
}
