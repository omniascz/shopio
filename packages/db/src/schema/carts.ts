/**
 * `carts` + `cart_items` — per `11-cart.md` ENT-CART-001 + ENT-CART-ITEM-001.
 *
 * MVP shape:
 * - Anonymous session: identified by `session_id` (signed cookie)
 * - Customer-linked: identified by `customer_id` (Fáze 1 wave 2 — when customers added)
 * - Single active cart per session per tenant (enforced by partial unique idx)
 *
 * Cart item stores variant_id + qty + snapshot price (so price changes
 * don't surprise customer; revalidated at checkout per `12 §RULE-CHK-007`).
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
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

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(),                                                                                                                                                                                                                                                                                                                                                                                                                                                                              // crt_ NanoID
    /** Anonymous session ID (from signed cookie). Null for customer-linked. */
    sessionId: text('session_id'),
    /** Customer reference (Fáze 1 wave 2). */
    customerId: uuid('customer_id'),
    /** Lifecycle. */
    status: text('status', { enum: ['active', 'merged', 'abandoned', 'converted', 'expired'] })
      .notNull()
      .default('active'),
    statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
    /** Currency snapshot from tenant default at creation. */
    currency: text('currency').notNull(),
    /** Audit. */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),                                                                                                                                                                                                                                                                                                                                                                                                                                                              // anonymous carts expire after N days
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_carts_pub_id').on(t.tenantId, t.pubId),
    activeBySession: uniqueIndex('uq_carts_active_session')
      .on(t.tenantId, t.sessionId)
      .where(sql`status = 'active' AND session_id IS NOT NULL`),
    activeByCustomer: uniqueIndex('uq_carts_active_customer')
      .on(t.tenantId, t.customerId)
      .where(sql`status = 'active' AND customer_id IS NOT NULL`),
    tenantStatusIdx: index('idx_carts_tenant_status').on(t.tenantId, t.status),
    expiryIdx: index('idx_carts_expiry').on(t.expiresAt).where(sql`status = 'active'`),
  }),
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(),                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            // cti_ NanoID
    /** Variant snapshot — variant_id + product_id captured for joins. */
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    /** Quantity. */
    quantity: integer('quantity').notNull(),
    /** Price snapshot — minor units. Re-evaluated at checkout per `12 §RULE-CHK-007`. */
    unitPriceAmount: bigint('unit_price_amount', { mode: 'bigint' }).notNull(),
    unitPriceCurrency: text('unit_price_currency').notNull(),
    /** Title snapshot for display (variant might be deleted before checkout completes). */
    titleSnapshot: text('title_snapshot').notNull(),
    /** Audit. */
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    cartIdx: index('idx_cart_items_cart').on(t.cartId, t.addedAt),
    /** One row per (cart, variant) — adds merge into existing row by incrementing qty. */
    cartVariantUnique: uniqueIndex('uq_cart_items_cart_variant').on(t.cartId, t.variantId),
  }),
);

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
