/**
 * Inventory domain — reservations + physical ledger per `09-inventory.md` MVP.
 *
 * Semantics (single warehouse):
 *   available = stock_on_hand − stock_reserved
 *   checkout      → reserve (active hold; TTL for unpaid orders)
 *   payment       → clear TTL (hold indefinitely)
 *   handover      → convert: physical `sale` movement, stock_on_hand −= covered
 *   cancel/expire → release the hold (no movement)
 *   return        → physical `return` movement, stock_on_hand += qty
 *
 * Concurrency: every mutation runs inside the caller's transaction with the
 * affected variant rows locked FOR UPDATE (checkout already does this; the
 * helpers here lock for their own flows). Pure quantity math is exported
 * separately for unit tests.
 *
 * Backward compatibility: orders placed before the reservation model already
 * decremented stock_on_hand at checkout. Their shipments have no reservation,
 * so `commitShipmentStock` only decrements physical stock up to the quantity
 * covered by an active reservation (`coveredQuantity`) — old orders ship
 * without double-decrementing.
 */

import { and, asc, eq, inArray, lte, sql as dsql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';

type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

/** TTL for unpaid-order holds — mirrors Stripe Checkout's 24h session + slack. */
export const UNPAID_RESERVATION_TTL_HOURS = 48;

/** available = on hand − reserved (RULE-INV semantics). */
export function availableQuantity(variant: {
  stockOnHand: number;
  stockReserved: number;
}): number {
  return variant.stockOnHand - variant.stockReserved;
}

/**
 * How much of a shipped quantity is covered by the order's active hold —
 * the physical decrement is capped at this (pre-reservation orders → 0).
 */
export function coveredQuantity(shippedQuantity: number, activeReservedQuantity: number): number {
  return Math.max(0, Math.min(shippedQuantity, activeReservedQuantity));
}

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

/**
 * Create order reservations + bump the denormalized aggregate. Caller must
 * hold FOR UPDATE locks on the variants (checkout does) and have validated
 * availability.
 */
export async function reserveStock(
  tx: DbConn,
  input: {
    tenantId: string;
    orderId: string;
    lines: ReserveLine[];
    expiresAt: Date | null;
  },
): Promise<void> {
  if (input.lines.length === 0) return;
  await tx.insert(schema.stockReservations).values(
    input.lines.map((l) => ({
      tenantId: input.tenantId,
      variantId: l.variantId,
      orderId: input.orderId,
      quantity: l.quantity,
      status: 'active' as const,
      expiresAt: input.expiresAt,
    })),
  );
  for (const l of input.lines) {
    await tx
      .update(schema.productVariants)
      .set({
        stockReserved: dsql`${schema.productVariants.stockReserved} + ${l.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.productVariants.id, l.variantId));
  }
}

/** Paid orders hold stock indefinitely — drop the TTL. */
export async function clearReservationExpiry(db: DbConn, orderId: string): Promise<void> {
  await db
    .update(schema.stockReservations)
    .set({ expiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.stockReservations.orderId, orderId),
        eq(schema.stockReservations.status, 'active'),
      ),
    );
}

/**
 * Release every active hold of an order (cancellation/expiry). No physical
 * movement — the goods never left the shelf.
 */
export async function releaseOrderReservations(
  db: DbConn,
  orderId: string,
  reason: 'order_cancelled' | 'expired',
): Promise<number> {
  const released = await db
    .update(schema.stockReservations)
    .set({
      status: 'released',
      releasedAt: new Date(),
      releasedReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.stockReservations.orderId, orderId),
        eq(schema.stockReservations.status, 'active'),
      ),
    )
    .returning({
      variantId: schema.stockReservations.variantId,
      quantity: schema.stockReservations.quantity,
    });
  for (const r of released) {
    await db
      .update(schema.productVariants)
      .set({
        stockReserved: dsql`GREATEST(${schema.productVariants.stockReserved} - ${r.quantity}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.productVariants.id, r.variantId));
  }
  return released.length;
}

export interface CommitLine {
  variantId: string;
  quantity: number;
}

/**
 * Physical stock-out at shipment handover. For each variant: lock the row,
 * compute the reservation-covered share, write the `sale` movement, and
 * decrement on-hand + reserved by the covered amount. Reservation rows are
 * consumed oldest-first.
 */
export async function commitShipmentStock(
  tx: DbConn,
  input: {
    tenantId: string;
    orderId: string;
    shipmentId: string;
    lines: CommitLine[];
    actorUserId?: string | null;
  },
): Promise<void> {
  for (const line of input.lines) {
    if (line.quantity <= 0) continue;

    const [variant] = await tx
      .select({
        id: schema.productVariants.id,
        stockOnHand: schema.productVariants.stockOnHand,
        stockReserved: schema.productVariants.stockReserved,
      })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, line.variantId))
      .for('update');
    if (!variant) continue;

    const reservations = await tx
      .select()
      .from(schema.stockReservations)
      .where(
        and(
          eq(schema.stockReservations.orderId, input.orderId),
          eq(schema.stockReservations.variantId, line.variantId),
          eq(schema.stockReservations.status, 'active'),
        ),
      )
      .orderBy(asc(schema.stockReservations.createdAt));

    const activeHeld = reservations.reduce((s, r) => s + r.quantity, 0);
    const covered = coveredQuantity(line.quantity, activeHeld);

    // Consume reservation rows oldest-first
    let remaining = covered;
    for (const r of reservations) {
      if (remaining <= 0) break;
      const take = Math.min(r.quantity, remaining);
      remaining -= take;
      if (take === r.quantity) {
        await tx
          .update(schema.stockReservations)
          .set({
            quantity: 0,
            status: 'converted',
            releasedAt: new Date(),
            releasedReason: 'converted',
            updatedAt: new Date(),
          })
          .where(eq(schema.stockReservations.id, r.id));
      } else {
        await tx
          .update(schema.stockReservations)
          .set({ quantity: r.quantity - take, updatedAt: new Date() })
          .where(eq(schema.stockReservations.id, r.id));
      }
    }

    if (covered > 0) {
      const newOnHand = variant.stockOnHand - covered;
      await tx
        .update(schema.productVariants)
        .set({
          stockOnHand: newOnHand,
          stockReserved: dsql`GREATEST(${schema.productVariants.stockReserved} - ${covered}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.productVariants.id, line.variantId));
      await tx.insert(schema.stockMovements).values({
        tenantId: input.tenantId,
        variantId: line.variantId,
        quantityDelta: -covered,
        reason: 'sale',
        referenceType: 'shipment',
        referenceId: input.shipmentId,
        resultingStockOnHand: newOnHand,
        actorUserId: input.actorUserId ?? null,
      });
    }
    // Uncovered share = pre-reservation order whose stock was already
    // decremented at checkout — nothing further to move.
  }
}

/**
 * Physical stock-in for a return restock (replaces the bare increment).
 */
export async function restockReturn(
  tx: DbConn,
  input: {
    tenantId: string;
    variantId: string;
    quantity: number;
    returnId: string;
    actorUserId?: string | null;
  },
): Promise<void> {
  const [variant] = await tx
    .select({
      stockOnHand: schema.productVariants.stockOnHand,
    })
    .from(schema.productVariants)
    .where(eq(schema.productVariants.id, input.variantId))
    .for('update');
  if (!variant) return;

  const newOnHand = variant.stockOnHand + input.quantity;
  await tx
    .update(schema.productVariants)
    .set({ stockOnHand: newOnHand, updatedAt: new Date() })
    .where(eq(schema.productVariants.id, input.variantId));
  await tx.insert(schema.stockMovements).values({
    tenantId: input.tenantId,
    variantId: input.variantId,
    quantityDelta: input.quantity,
    reason: 'return',
    referenceType: 'return',
    referenceId: input.returnId,
    resultingStockOnHand: newOnHand,
    actorUserId: input.actorUserId ?? null,
  });
}

/**
 * Sweep expired unpaid holds (JOB-SWEEP-EXPIRED-RESERVATIONS, dev-grade
 * interval timer — BullMQ takes over in a later wave). Cancels the orphaned
 * pending_payment orders and releases their stock.
 */
export async function sweepExpiredReservations(
  db: AppDb,
  log: FastifyBaseLogger,
): Promise<number> {
  const now = new Date();
  const expired = await db
    .select({ orderId: schema.stockReservations.orderId })
    .from(schema.stockReservations)
    .where(
      and(
        eq(schema.stockReservations.status, 'active'),
        lte(schema.stockReservations.expiresAt, now),
      ),
    );
  if (expired.length === 0) return 0;

  const orderIds = [...new Set(expired.map((e) => e.orderId))];
  let swept = 0;
  for (const orderId of orderIds) {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: schema.orders.id, status: schema.orders.status })
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update')
        .limit(1);
      if (!order) return;

      // Paid in the meantime? Just clear the TTL and keep the hold.
      if (order.status !== 'pending_payment') {
        await clearReservationExpiry(tx, orderId);
        return;
      }

      await releaseOrderReservations(tx, orderId, 'expired');
      await tx
        .update(schema.orders)
        .set({
          status: 'cancelled',
          statusEnteredAt: now,
          cancelledAt: now,
          paymentStatus: 'failed',
          updatedAt: now,
        })
        .where(eq(schema.orders.id, orderId));
      swept += 1;
      log.info({ orderId }, 'inventory.sweeper.order_expired');
    });
  }
  return swept;
}

/** Active reservation totals per variant for a set of orders (diagnostics). */
export async function activeReservationsForOrder(
  db: DbConn,
  orderId: string,
): Promise<{ variantId: string; quantity: number }[]> {
  const rows = await db
    .select({
      variantId: schema.stockReservations.variantId,
      quantity: schema.stockReservations.quantity,
    })
    .from(schema.stockReservations)
    .where(
      and(
        eq(schema.stockReservations.orderId, orderId),
        eq(schema.stockReservations.status, 'active'),
      ),
    );
  return rows;
}

/** Release helper for a batch of orders (admin bulk ops later). */
export async function releaseMany(
  db: AppDb,
  orderIds: string[],
  reason: 'order_cancelled' | 'expired',
): Promise<void> {
  if (orderIds.length === 0) return;
  const rows = await db
    .select({ orderId: schema.stockReservations.orderId })
    .from(schema.stockReservations)
    .where(
      and(
        inArray(schema.stockReservations.orderId, orderIds),
        eq(schema.stockReservations.status, 'active'),
      ),
    );
  for (const r of [...new Set(rows.map((x) => x.orderId))]) {
    await db.transaction(async (tx) => {
      await releaseOrderReservations(tx, r, reason);
    });
  }
}
