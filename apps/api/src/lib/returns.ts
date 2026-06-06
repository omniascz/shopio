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

import { and, eq, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';

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

// =============================================================================
// Return creation — shared by the admin route and the customer portal
// =============================================================================

export interface CreateReturnInput {
  tenantId: string;
  /** Internal order uuid — caller resolves + authorizes ownership. */
  orderId: string;
  items: { orderItemPubId: string; quantity: number }[];
  reasonCode: 'changed_mind' | 'damaged' | 'wrong_item' | 'not_as_described' | 'other';
  customerNote?: string | null;
  staffNote?: string | null;
  createdByUserId?: string | null;
}

export interface CreatedReturn {
  ret: typeof schema.returns.$inferSelect;
  items: (typeof schema.returnItems.$inferSelect)[];
}

/**
 * Create a return in `requested` state. Validates payment status, per-item
 * returnable quantities (across prior live returns), freezes proportional
 * refund snapshots, and allocates the RMA number under an advisory lock.
 * Throws ReturnError for business violations.
 */
export async function createReturn(db: AppDb, input: CreateReturnInput): Promise<CreatedReturn> {
  if (input.items.length === 0) {
    throw new ReturnError('NO_ITEMS', 'No items to return');
  }

  // RLS-enforced (per `30`): all reads + writes run under the tenant GUC.
  return withTenant(db, input.tenantId, async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.id, input.orderId), eq(schema.orders.tenantId, input.tenantId)))
      .limit(1);
    if (!order) throw new ReturnError('ORDER_NOT_FOUND', 'Order not found');

    // RULE-RTN-001 subset: only paid-side orders can be returned
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded') {
      throw new ReturnError('ORDER_NOT_REFUNDABLE', 'Order has no captured payment');
    }

    const orderItems = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));
    const itemsByPubId = new Map(orderItems.map((it) => [it.pubId, it]));

    // Prior holds per order item (RULE-RTN-009 subset)
    const priorItems = await tx
      .select({
        orderItemId: schema.returnItems.orderItemId,
        quantity: schema.returnItems.quantity,
        status: schema.returns.status,
      })
      .from(schema.returnItems)
      .innerJoin(schema.returns, eq(schema.returns.id, schema.returnItems.returnId))
      .where(eq(schema.returns.orderId, order.id));


    const lines = input.items.map((reqItem) => {
      const orderItem = itemsByPubId.get(reqItem.orderItemPubId);
      if (!orderItem) {
        throw new ReturnError('ORDER_ITEM_NOT_FOUND', `Unknown item ${reqItem.orderItemPubId}`);
      }
      const remaining = returnableQuantity(
        orderItem.quantity,
        priorItems.filter((p) => p.orderItemId === orderItem.id),
      );
      if (reqItem.quantity > remaining) {
        throw new ReturnError(
          'QUANTITY_EXCEEDS_RETURNABLE',
          `${orderItem.productTitleSnapshot}: returnable ${remaining}, requested ${reqItem.quantity}`,
        );
      }
      return { orderItem, computed: computeReturnLine(orderItem, reqItem.quantity) };
    });

    const requestedRefund = lines.reduce((s, l) => s + l.computed.lineGrossAmount, 0n);

    // RMA number — advisory lock serializes concurrent creates (no collisions)
    const year = new Date().getFullYear();
    await tx.execute(
      dsql`SELECT pg_advisory_xact_lock(hashtext(${`rma:${input.tenantId}:${year}`}))`,
    );
    const [cnt] = await tx
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(schema.returns)
      .where(
        and(
          eq(schema.returns.tenantId, input.tenantId),
          dsql`EXTRACT(YEAR FROM ${schema.returns.requestedAt}) = ${year}`,
        ),
      );
    const number = formatReturnNumber(year, (cnt?.count ?? 0) + 1);

    const [ret] = await tx
      .insert(schema.returns)
      .values({
        tenantId: input.tenantId,
        pubId: generatePubId('ret'),
        orderId: order.id,
        number,
        status: 'requested',
        reasonCode: input.reasonCode,
        customerNote: input.customerNote ?? null,
        staffNote: input.staffNote ?? null,
        currency: order.currency,
        requestedRefundAmount: requestedRefund,
        createdByUserId: input.createdByUserId ?? null,
      })
      .returning();
    if (!ret) throw new ReturnError('RETURN_INSERT_FAILED', 'Could not create return');

    const items = await tx
      .insert(schema.returnItems)
      .values(
        lines.map((l) => ({
          tenantId: input.tenantId,
          returnId: ret.id,
          pubId: generatePubId('rti'),
          orderItemId: l.orderItem.id,
          variantId: l.orderItem.variantId,
          titleSnapshot: `${l.orderItem.productTitleSnapshot} — ${l.orderItem.variantTitleSnapshot}`,
          skuSnapshot: l.orderItem.skuSnapshot,
          quantity: l.computed.quantity,
          unitGrossAmount: l.computed.unitGrossAmount,
          lineGrossAmount: l.computed.lineGrossAmount,
          lineNetAmount: l.computed.lineNetAmount,
          lineTaxAmount: l.computed.lineTaxAmount,
          taxClassCode: l.computed.taxClassCode,
          taxRateBasisPoints: l.computed.taxRateBasisPoints,
        })),
      )
      .returning();

    return { ret, items };
  });
}
