/**
 * `orders` + `order_items` — per `12-checkout.md` + `16-order-management.md`.
 *
 * Orders are immutable historical snapshots:
 * - Customer email + shipping address denormalized (so order survives
 *   customer profile deletion per `RULE-SEC-038`).
 * - Line items snapshot variant title + price (so historical accounting accurate).
 *
 * MVP simplifications:
 * - No customer entity yet — orders just have customer_email
 * - No payment integration — status='pending_payment' is terminal in MVP
 * - No taxes (placeholder fields for Fáze 1 wave 2)
 * - No shipping costs (just zero for MVP)
 * - Sequential order numbers per tenant: ORD-{year}-{seq}
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
import { productVariants } from './product-variants';
import { products } from './products';
import { tenants } from './tenants';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // ord_ NanoID
    /** Per-tenant sequential — e.g. ORD-2026-00000001. */
    orderNumber: text('order_number').notNull(),
    /** Customer snapshot (no customer table yet — Fáze 1 wave 2). */
    customerEmail: text('customer_email').notNull(),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    /** Shipping address snapshot. */
    shippingAddress: jsonb('shipping_address').notNull(), // { line1, line2, city, postal_code, country_code, ... }
    /** Billing address snapshot (defaults to shipping). */
    billingAddress: jsonb('billing_address'),
    /** Money totals — minor units. */
    currency: text('currency').notNull(),
    subtotalAmount: bigint('subtotal_amount', { mode: 'bigint' }).notNull(), // sum of line subtotals
    discountAmount: bigint('discount_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`), // future
    shippingAmount: bigint('shipping_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** Chosen shipping method snapshot (per `14-shipping.md`):
     * { carrier_code, service_code, display_name, rate_id }. */
    shippingMethod: jsonb('shipping_method'),
    /** Selected pickup point snapshot (Zásilkovna výdejna / Z-BOX), if any:
     * { external_id, name, street, city, postal_code, country_code }. */
    pickupPoint: jsonb('pickup_point'),
    taxAmount: bigint('tax_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** Whether line prices were gross (VAT-inclusive) at placement — snapshot. */
    priceIncludesTax: boolean('price_includes_tax').notNull().default(true),
    /** VAT breakdown grouped by rate, snapshot per `15 §4` STAGE 7.
     * [{ tax_class, rate_basis_points, base_amount, tax_amount }] */
    taxBreakdown: jsonb('tax_breakdown')
      .notNull()
      .default(sql`'[]'::jsonb`),
    totalAmount: bigint('total_amount', { mode: 'bigint' }).notNull(),
    /** Cumulative amount refunded via returns (per `17-returns-refunds.md` RULE-RTN-015). */
    refundedAmount: bigint('refunded_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** Aggregate lifecycle status per `16-order-management.md`. */
    status: text('status', {
      enum: [
        'pending_payment',
        'paid',
        'partially_paid',
        'fulfilling',
        'fulfilled',
        'cancelled',
        'refunded',
      ],
    })
      .notNull()
      .default('pending_payment'),
    statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
    /** Payment status snapshot — MVP: mock. */
    paymentStatus: text('payment_status', {
      enum: ['pending', 'authorized', 'paid', 'failed', 'refunded'],
    })
      .notNull()
      .default('pending'),
    paymentMethod: text('payment_method'), // 'mock', 'stripe', 'gopay', ...
    /** Source channel (per `22-multistore-channels.md`). */
    channelKind: text('channel_kind').notNull().default('storefront_web'),
    /** Locale snapshot. */
    customerLocale: text('customer_locale'),
    /** Notes. */
    customerNote: text('customer_note'),
    /** Audit. */
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_orders_pub_id').on(t.tenantId, t.pubId),
    orderNumberUnique: uniqueIndex('uq_orders_order_number').on(t.tenantId, t.orderNumber),
    tenantStatusIdx: index('idx_orders_tenant_status').on(t.tenantId, t.status, t.placedAt),
    customerEmailIdx: index('idx_orders_customer_email').on(t.tenantId, t.customerEmail),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // oit_ NanoID
    /** Variant + product refs — kept for joins (variants may evolve). */
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    /** Snapshots. */
    productTitleSnapshot: text('product_title_snapshot').notNull(),
    variantTitleSnapshot: text('variant_title_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot'),
    /** Quantity + pricing — minor units. */
    quantity: integer('quantity').notNull(),
    unitPriceAmount: bigint('unit_price_amount', { mode: 'bigint' }).notNull(),
    unitPriceCurrency: text('unit_price_currency').notNull(),
    /** Line totals (computed at placement; immutable). */
    lineSubtotalAmount: bigint('line_subtotal_amount', { mode: 'bigint' }).notNull(), // unit_price × qty
    lineDiscountAmount: bigint('line_discount_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    /** VAT snapshot per `15 §3.6` — class + rate frozen at placement. */
    taxClassCode: text('tax_class_code').notNull().default('standard'),
    taxRateBasisPoints: integer('tax_rate_basis_points').notNull().default(0),
    lineTaxAmount: bigint('line_tax_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    lineTotalAmount: bigint('line_total_amount', { mode: 'bigint' }).notNull(),
    /** Audit. */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    orderIdx: index('idx_order_items_order').on(t.orderId),
    variantIdx: index('idx_order_items_variant')
      .on(t.variantId)
      .where(sql`variant_id IS NOT NULL`),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
