/**
 * `variant_price_history` — per EU Omnibus directive (2019/2161, CZ §12a ZOS,
 * SK 108/2024). When a price is reduced, the merchant MUST display the lowest
 * price of the prior 30 days. We record every variant price change (via a DB
 * trigger, so all write paths are covered) and derive the 30-day low on read.
 *
 * Append-only; the trigger only inserts when `price_amount` actually changes.
 */

import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { productVariants } from './product-variants';

export const variantPriceHistory = pgTable(
  'variant_price_history',
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
    priceAmount: bigint('price_amount', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Hot path: lowest price for a variant within a time window.
    variantTimeIdx: index('idx_variant_price_history_variant').on(t.variantId, t.recordedAt),
  }),
);

export type VariantPriceHistory = typeof variantPriceHistory.$inferSelect;
