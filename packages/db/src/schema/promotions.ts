/**
 * `promotions` — automatic (no-code) cart promotions per `10-pricing-promotions.md`,
 * modelled on Magento's Cart Price Rules. Unlike coupons (a customer-entered
 * code), these apply automatically when the cart meets the conditions.
 *
 * Kinds:
 *  - order_percentage / order_fixed / free_shipping — a cart-level discount when
 *    the subtotal / item count thresholds are met.
 *  - bogo — "buy X get Y": for every (buy+get) qualifying units the cheapest
 *    `get` units are discounted by `getDiscountBps` (10000 = free).
 *
 * The engine in `apps/api/src/lib/promotions.ts` evaluates active rules against
 * the cart and produces the same {goodsDiscount, shippingDiscount} shape as the
 * coupon engine, so checkout combines them.
 */

import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const PROMOTION_KINDS = [
  'order_percentage',
  'order_fixed',
  'free_shipping',
  'bogo',
  'gift', // free gift added to the order when the cart qualifies (Shoptet "Dárek k objednávce")
] as const;

export const promotions = pgTable(
  'promotions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // prm_ NanoID
    name: text('name').notNull(),
    kind: text('kind', { enum: PROMOTION_KINDS }).notNull(),
    /** order_percentage: basis points (1500 = 15 %). order_fixed: minor units. */
    value: bigint('value', { mode: 'bigint' }).notNull().default(sql`0`),
    currency: text('currency'), // for order_fixed
    /** Cap the computed goods discount (minor units); null = uncapped. */
    maxDiscountAmount: bigint('max_discount_amount', { mode: 'bigint' }),
    // Conditions (all that are set must hold)
    minSubtotal: bigint('min_subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    minQuantity: integer('min_quantity').notNull().default(0),
    // BOGO config
    buyQuantity: integer('buy_quantity').notNull().default(0),
    getQuantity: integer('get_quantity').notNull().default(0),
    /** Discount on the "get" units in basis points (10000 = free). */
    getDiscountBps: integer('get_discount_bps').notNull().default(10000),
    /** gift kind: the variant given free when the cart qualifies (≥ minSubtotal). */
    giftVariantId: uuid('gift_variant_id'),
    // Stacking + ordering
    priority: integer('priority').notNull().default(0),
    stackable: boolean('stackable').notNull().default(true),
    // Validity
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_promotions_pub_id').on(t.tenantId, t.pubId),
    tenantActiveIdx: index('idx_promotions_tenant_active').on(t.tenantId, t.isActive),
  }),
);

export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;
