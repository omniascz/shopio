/**
 * `coupons` + `coupon_redemptions` — per `10-pricing-promotions.md` MVP.
 *
 * Lean shape: one coupon carries its own discount config (kind+value), instead
 * of the spec's discounts↔coupons split — enough for the common cases
 * (SLEVA10 / −200 Kč / doprava zdarma). Redemptions are an append-only log
 * used both for the audit trail and per-customer usage counting.
 *
 * VAT: a discount reduces the taxable gross (EU rule) — the checkout feeds
 * post-discount line amounts to the tax engine. See `apps/api/src/lib/coupons.ts`.
 *
 * Deferred: separate reusable discount entity, automatic (no-code) promotions,
 * BOGO/bundle/tiered, customer-group targeting, stacking of multiple coupons
 * (MVP = one coupon per cart), gift cards.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { customers } from './customers';
import { tenants } from './tenants';

export const COUPON_KINDS = ['percentage', 'fixed', 'free_shipping'] as const;

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // cpn_ NanoID
    /** Customer-entered code; case-insensitive match (compared upper-cased). */
    code: text('code').notNull(),
    description: text('description'),
    kind: text('kind', { enum: COUPON_KINDS }).notNull(),
    /** percentage: basis points (1500 = 15 %). fixed: minor units. free_shipping: ignored. */
    value: bigint('value', { mode: 'bigint' }).notNull().default(sql`0`),
    currency: text('currency'), // for fixed
    /** Cap the computed discount (minor units); null = uncapped. */
    maxDiscountAmount: bigint('max_discount_amount', { mode: 'bigint' }),
    /** Minimum cart goods subtotal (gross, minor units) to qualify. */
    minPurchaseAmount: bigint('min_purchase_amount', { mode: 'bigint' }).notNull().default(sql`0`),
    // Usage caps
    maxUsesTotal: integer('max_uses_total'), // null = unlimited
    maxUsesPerCustomer: integer('max_uses_per_customer'), // null = unlimited
    usageCount: integer('usage_count').notNull().default(0),
    // Validity window
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_coupons_pub_id').on(t.tenantId, t.pubId),
    codeUnique: uniqueIndex('uq_coupons_code').on(t.tenantId, t.code),
    tenantActiveIdx: index('idx_coupons_tenant_active').on(t.tenantId, t.isActive),
  }),
);

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Null for guest checkouts. */
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    amountSaved: bigint('amount_saved', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    couponIdx: index('idx_coupon_redemptions_coupon').on(t.couponId),
    customerIdx: index('idx_coupon_redemptions_customer')
      .on(t.couponId, t.customerId)
      .where(sql`customer_id IS NOT NULL`),
    orderUnique: uniqueIndex('uq_coupon_redemptions_order').on(t.orderId),
  }),
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
