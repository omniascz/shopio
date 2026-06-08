/**
 * `customer_groups` — wholesale / B2B price levels (Shoptet "Velkoobchod").
 *
 * A group carries a percentage discount applied to goods for its members at
 * checkout (and in the cart preview once logged in). MVP model: one % off the
 * whole catalogue per group — covers the common "velkoobchodní hladina" case
 * without per-product price lists.
 */

import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const customerGroups = pgTable(
  'customer_groups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // cgr_ NanoID
    name: text('name').notNull(),
    /** Goods discount in basis points (1500 = 15 %). */
    discountBps: integer('discount_bps').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_customer_groups_pub_id').on(t.tenantId, t.pubId),
  }),
);

export type CustomerGroup = typeof customerGroups.$inferSelect;
