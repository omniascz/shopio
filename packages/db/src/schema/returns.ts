/**
 * `returns` + `return_items` — per `17-returns-refunds.md` (ENT-RETURN-001,
 * ENT-RETURN-ITEM-001), MVP subset.
 *
 * Admin-initiated returns workflow (customer self-service portal lands later):
 *   requested → approved → received → refunded
 *   requested/approved → rejected | cancelled
 *
 * Money amounts are proportional snapshots frozen at creation (unit gross ×
 * qty + proportional VAT per RULE-RTN-012/013) so refunds stay correct even
 * if products change later. The refund itself goes through the payments
 * provider (Stripe; mock fallback) and issues a credit note (dobropis) via
 * the invoices domain (RULE-RTN-014).
 *
 * Deferred: fraud scoring, return labels, EU cooling-off automation,
 * restocking fees, exchanges, customer portal.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orderItems, orders } from './orders';
import { productVariants } from './product-variants';
import { tenants } from './tenants';

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'received',
  'refunded',
  'rejected',
  'cancelled',
] as const;

export const RETURN_REASONS = [
  'changed_mind',
  'damaged',
  'wrong_item',
  'not_as_described',
  'other',
] as const;

export const returns = pgTable(
  'returns',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // ret_ NanoID
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /** Per-tenant sequential — e.g. RMA-2026-0001. */
    number: text('number').notNull(),
    status: text('status', { enum: RETURN_STATUSES }).notNull().default('requested'),
    statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
    reasonCode: text('reason_code', { enum: RETURN_REASONS }).notNull().default('other'),
    customerNote: text('customer_note'),
    staffNote: text('staff_note'),
    // Money — minor units, frozen snapshots
    currency: text('currency').notNull(),
    /** Items refund estimate at creation (gross incl. VAT). */
    requestedRefundAmount: bigint('requested_refund_amount', { mode: 'bigint' }).notNull(),
    /** Shipping refunded on top of items (set during refund; 0 = none). */
    shippingRefundAmount: bigint('shipping_refund_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** Final amount actually refunded via the provider. */
    actualRefundAmount: bigint('actual_refund_amount', { mode: 'bigint' }),
    // Refund execution
    refundMethod: text('refund_method'), // 'stripe' | 'mock'
    refundReference: text('refund_reference'), // Stripe refund id / mock id
    creditNoteInvoiceId: uuid('credit_note_invoice_id'),
    // Lifecycle timestamps
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    // Audit
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_returns_pub_id').on(t.tenantId, t.pubId),
    numberUnique: uniqueIndex('uq_returns_number').on(t.tenantId, t.number),
    orderIdx: index('idx_returns_order').on(t.orderId),
    tenantStatusIdx: index('idx_returns_tenant_status').on(t.tenantId, t.status, t.requestedAt),
  }),
);

export const returnItems = pgTable(
  'return_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    returnId: uuid('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // rti_ NanoID
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    /** Display snapshots (survive product edits). */
    titleSnapshot: text('title_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot'),
    quantity: integer('quantity').notNull(),
    /** Proportional money snapshots (RULE-RTN-012/013) — minor units. */
    unitGrossAmount: bigint('unit_gross_amount', { mode: 'bigint' }).notNull(),
    lineGrossAmount: bigint('line_gross_amount', { mode: 'bigint' }).notNull(),
    lineNetAmount: bigint('line_net_amount', { mode: 'bigint' }).notNull(),
    lineTaxAmount: bigint('line_tax_amount', { mode: 'bigint' }).notNull(),
    taxClassCode: text('tax_class_code').notNull().default('standard'),
    taxRateBasisPoints: integer('tax_rate_basis_points').notNull().default(0),
    /** Restock decision applied during refund step (RULE-RTN-011 subset). */
    restocked: boolean('restocked').notNull().default(false),
    restockedAt: timestamp('restocked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_return_items_pub_id').on(t.tenantId, t.pubId),
    returnIdx: index('idx_return_items_return').on(t.returnId),
    orderItemIdx: index('idx_return_items_order_item').on(t.orderItemId),
  }),
);

export type Return = typeof returns.$inferSelect;
export type NewReturn = typeof returns.$inferInsert;
export type ReturnItem = typeof returnItems.$inferSelect;
export type NewReturnItem = typeof returnItems.$inferInsert;
