/**
 * `stock_reservations` + `stock_movements` — per `09-inventory.md`
 * (ENT-STOCK-RESERVATION-001, ENT-STOCK-MOVEMENT-001), MVP subset.
 *
 * Single-warehouse model layered on `product_variants.stock_on_hand`:
 *   available = stock_on_hand − stock_reserved   (denormalized aggregate)
 *
 * Lifecycle:
 *   checkout    → reservation active (expires for unpaid orders)
 *   paid        → expiry cleared (held indefinitely)
 *   handover    → reservation converted + `sale` movement (physical decrement)
 *   cancel/expiry → reservation released (no movement — nothing left the shelf)
 *   return restock → `return` movement (physical increment)
 *
 * `stock_movements` is an append-only physical ledger (RULE-INV: ledger
 * immutability) — corrections are new rows, never updates. Σ movements should
 * equal current stock_on_hand for variants created after the baseline
 * `initial_load` rows (reconciliation job comes later).
 *
 * Deferred: warehouses/MSI, cart-level reservations with sliding TTL,
 * inventory counts, COGS, backorder queues.
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { productVariants } from './product-variants';
import { tenants } from './tenants';

export const stockReservations = pgTable(
  'stock_reservations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Remaining held quantity — decremented as shipments convert it. */
    quantity: integer('quantity').notNull(),
    status: text('status', { enum: ['active', 'released', 'converted'] })
      .notNull()
      .default('active'),
    /** NULL = no expiry (paid orders). Unpaid orders get a TTL; the sweeper
     * releases overdue holds and cancels their orders. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedReason: text('released_reason'), // 'order_cancelled' | 'expired' | 'converted'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    variantActiveIdx: index('idx_stock_reservations_variant')
      .on(t.variantId)
      .where(sql`status = 'active'`),
    orderIdx: index('idx_stock_reservations_order').on(t.orderId),
    expiryIdx: index('idx_stock_reservations_expiry')
      .on(t.expiresAt)
      .where(sql`status = 'active' AND expires_at IS NOT NULL`),
  }),
);

export const STOCK_MOVEMENT_REASONS = [
  'sale',
  'return',
  'adjustment',
  'initial_load',
] as const;

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    /** Physical change — never 0. Negative = stock out (sale), positive = in. */
    quantityDelta: integer('quantity_delta').notNull(),
    reason: text('reason', { enum: STOCK_MOVEMENT_REASONS }).notNull(),
    /** Polymorphic reference: 'shipment' | 'return' | 'manual' | 'migration'. */
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    /** stock_on_hand right after this movement (audit snapshot). */
    resultingStockOnHand: integer('resulting_stock_on_hand').notNull(),
    actorUserId: uuid('actor_user_id'),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    variantIdx: index('idx_stock_movements_variant').on(t.variantId, t.occurredAt),
    tenantReasonIdx: index('idx_stock_movements_tenant_reason').on(
      t.tenantId,
      t.reason,
      t.occurredAt,
    ),
  }),
);

export type StockReservation = typeof stockReservations.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
