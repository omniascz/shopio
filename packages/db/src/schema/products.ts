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
    /** Product kind (per `06` ENT-PRODUCT-001). `bundle` = composed of child
     * variants via `product_bundle_items`; everything else sells normally. */
    type: text('type', {
      enum: ['simple', 'variable', 'bundle', 'digital', 'service', 'gift_card'],
    })
      .notNull()
      .default('simple'),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    descriptionHtml: text('description_html'),
    // Pricing (base; per `10-pricing-promotions.md` variants override)
    basePriceAmount: bigint('base_price_amount', { mode: 'bigint' }), // minor units (e.g. haléře)
    basePriceCurrency: text('base_price_currency'), // ISO 4217
    compareAtAmount: bigint('compare_at_amount', { mode: 'bigint' }), // strikethrough
    // Tax (per `15-tax-compliance.md` §4 — tax class drives VAT rate at checkout)
    taxClassCode: text('tax_class_code').notNull().default('standard'),
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
    /** Marketplace seller that owns this product (per `25`), null = platform-owned. */
    vendorId: uuid('vendor_id'),
    brandName: text('brand_name'),
    /** Structured spec parameters (per `06` PIM, MVP): ordered key→value pairs
     * shown as a "Specifikace" table and indexed as Meilisearch facets.
     * [{ name: "Materiál", value: "Kamenina" }, …] */
    attributes: jsonb('attributes')
      .notNull()
      .default(sql`'[]'::jsonb`),
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
