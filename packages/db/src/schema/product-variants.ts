/**
 * `product_variants` — per `06-catalog-pim.md` ENT-PRODUCT-VARIANT-001.
 *
 * Each product has 1+ variants. Single-variant products use a "default" variant
 * matching the parent product. Multi-variant (size, color) use multiple rows.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './products';
import { tenants } from './tenants';

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // prv_ NanoID
    sku: text('sku'),
    barcode: text('barcode'), // EAN/UPC
    title: text('title').notNull().default('Default'), // e.g. "Black / Large"
    // Pricing override (per `10-pricing-promotions.md`; falls back to product.basePriceAmount)
    priceAmount: bigint('price_amount', { mode: 'bigint' }).notNull(),
    priceCurrency: text('price_currency').notNull(),
    compareAtAmount: bigint('compare_at_amount', { mode: 'bigint' }),
    // Cost (private)
    costAmount: bigint('cost_amount', { mode: 'bigint' }),
    // Physical
    weightGrams: integer('weight_grams'),
    requiresShipping: boolean('requires_shipping').notNull().default(true),
    // Stock (managed properly in `inventory` module; this is the simple counter for MVP)
    stockOnHand: integer('stock_on_hand').notNull().default(0),
    allowBackorder: boolean('allow_backorder').notNull().default(false),
    // Options (e.g. { color: 'black', size: 'L' })
    optionValues: jsonb('option_values')
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Sort
    position: integer('position').notNull().default(0),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_product_variants_pub_id').on(t.tenantId, t.pubId),
    skuUnique: uniqueIndex('uq_product_variants_sku')
      .on(t.tenantId, t.sku)
      .where(sql`sku IS NOT NULL`),
    productIdx: index('idx_product_variants_product').on(t.productId, t.position),
    tenantSkuIdx: index('idx_product_variants_tenant_sku')
      .on(t.tenantId, t.sku)
      .where(sql`sku IS NOT NULL`),
  }),
);

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
