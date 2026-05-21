/**
 * `products` — per `06-catalog-pim.md` ENT-PRODUCT-001.
 *
 * MVP shape; full PIM (metafields, attributes, bundles, brand/vendor refs, ...)
 * added in subsequent waves.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const products = pgTable(
  'products',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // prd_ NanoID
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    descriptionHtml: text('description_html'),
    // Pricing (base; per `10-pricing-promotions.md` variants override)
    basePriceAmount: bigint('base_price_amount', { mode: 'bigint' }), // minor units (e.g. haléře)
    basePriceCurrency: text('base_price_currency'), // ISO 4217
    compareAtAmount: bigint('compare_at_amount', { mode: 'bigint' }), // strikethrough
    // SEO
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    // Lifecycle
    status: text('status', { enum: ['draft', 'active', 'archived', 'unpublished'] })
      .notNull()
      .default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Vendor / brand (FK Fáze 2)
    vendor: text('vendor'),
    brandName: text('brand_name'),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid('created_by_user_id'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_products_pub_id').on(t.tenantId, t.pubId),
    slugUnique: uniqueIndex('uq_products_slug').on(t.tenantId, t.slug),
    tenantStatusIdx: index('idx_products_tenant_status').on(t.tenantId, t.status),
    activeTenantIdx: index('idx_products_active')
      .on(t.tenantId, t.publishedAt)
      .where(sql`status = 'active'`),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
