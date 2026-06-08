/**
 * `collections` — dynamic product groups (P3), modelled on Shopify Smart
 * Collections / Shopware Dynamic Product Groups. Unlike categories (a manual
 * hierarchy), a collection is defined by RULES and stays up to date on its own
 * (e.g. "on sale", "in stock under 500 Kč", "brand = Acme").
 *
 * `rules` is a fixed-shape object (MVP): { minPrice, maxPrice, onSaleOnly,
 * inStockOnly, brand, vendor, sort }. Resolution lives in lib/collections.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const collections = pgTable(
  'collections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // col_ NanoID
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    /** { minPrice?, maxPrice?, onSaleOnly?, inStockOnly?, brand?, vendor?, sort? } */
    rules: jsonb('rules')
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_collections_pub_id').on(t.tenantId, t.pubId),
    slugUnique: uniqueIndex('uq_collections_slug').on(t.tenantId, t.slug),
    tenantActiveIdx: index('idx_collections_tenant_active').on(t.tenantId, t.isActive),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
