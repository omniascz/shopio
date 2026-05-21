/**
 * `product_categories` — M:M link between products and categories.
 *
 * Per `06-catalog-pim.md` + `07-categories-taxonomy.md`.
 * A product can belong to multiple categories; categories can have many products.
 */

import { index, integer, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';
import { categories } from './categories';
import { tenants } from './tenants';

export const productCategories = pgTable(
  'product_categories',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** Position of product within this category (manual sort override). */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.categoryId] }),
    categoryIdx: index('idx_product_categories_category').on(t.categoryId, t.position),
    tenantIdx: index('idx_product_categories_tenant').on(t.tenantId),
  }),
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
