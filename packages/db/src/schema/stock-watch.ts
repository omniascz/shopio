/**
 * `stock_watches` — back-in-stock notifications (Shoptet "Hlídací pes").
 *
 * A shopper on an out-of-stock variant leaves an e-mail; when the variant is
 * restocked we send one notification and mark it sent. One pending row per
 * (variant, email).
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { productVariants } from './product-variants';

export const stockWatches = pgTable(
  'stock_watches',
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
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when the back-in-stock e-mail has been sent (null = still watching). */
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => ({
    pendingUnique: uniqueIndex('uq_stock_watches_pending').on(t.variantId, t.email),
    variantIdx: index('idx_stock_watches_variant').on(t.tenantId, t.variantId),
  }),
);

export type StockWatch = typeof stockWatches.$inferSelect;
