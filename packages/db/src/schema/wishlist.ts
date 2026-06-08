/**
 * `wishlist_items` — server-side wishlist (P2, per `18-customer-management.md`).
 *
 * Today favourites live in the storefront's localStorage (per-device). A
 * server-side list persists across devices and is a remarketing signal
 * (BigCommerce/Wix both have it natively). One row per (customer, product).
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { products } from './products';

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemUnique: uniqueIndex('uq_wishlist_items').on(t.customerId, t.productId),
    customerIdx: index('idx_wishlist_items_customer').on(t.tenantId, t.customerId),
  }),
);

export type WishlistItem = typeof wishlistItems.$inferSelect;
