/**
 * `product_bundle_items` — per `06-catalog-pim.md` §3.5 (ENT-PRODUCT-005).
 *
 * Defines what a bundle product (`products.type='bundle'`) contains: child
 * variants + quantities. The bundle carries its OWN price (RULE-PRODUCT-013 —
 * a bundle price is not the auto-sum of its children); these rows are the
 * composition used for the storefront component list and derived availability.
 *
 * Cycle prevention (a bundle child pointing back at the bundle, RULE-PRODUCT-004)
 * is enforced in the application layer (`apps/api/src/lib/bundles.ts`).
 */

import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { products } from './products';
import { productVariants } from './product-variants';

export const productBundleItems = pgTable(
  'product_bundle_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    childVariantId: uuid('child_variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    isOptional: boolean('is_optional').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemUnique: uniqueIndex('uq_bundle_items').on(t.bundleId, t.childVariantId),
    bundleIdx: index('idx_bundle_items_bundle').on(t.tenantId, t.bundleId, t.position),
  }),
);

export type ProductBundleItem = typeof productBundleItems.$inferSelect;
export type NewProductBundleItem = typeof productBundleItems.$inferInsert;
