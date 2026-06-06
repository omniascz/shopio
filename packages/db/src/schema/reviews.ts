/**
 * `product_reviews` — per `19-marketing-seo.md` + `20-analytics` reviews MVP.
 *
 * Per-tenant, one review per customer per product. `verified_purchase` is set
 * when the reviewer has a paid order containing the product (trust signal +
 * Google rich-result eligibility). Moderation: status pending→published/
 * rejected (default published in MVP; the admin can hide).
 *
 * Aggregates (avg rating, count) are computed on read for now; a denormalized
 * rollup on `products` comes if review volume needs it.
 *
 * Deferred: review photos, merchant replies, helpfulness votes, Q&A.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { customers } from './customers';
import { products } from './products';
import { tenants } from './tenants';

export const productReviews = pgTable(
  'product_reviews',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // rev_ NanoID
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Display name snapshot (survives account edits/deletion). */
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(), // 1–5, enforced in app + CHECK
    title: text('title'),
    body: text('body'),
    /** Reviewer has a paid order containing this product. */
    verifiedPurchase: boolean('verified_purchase').notNull().default(false),
    status: text('status', { enum: ['published', 'pending', 'rejected'] })
      .notNull()
      .default('published'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_product_reviews_pub_id').on(t.tenantId, t.pubId),
    /** One review per customer per product. */
    onePerCustomer: uniqueIndex('uq_product_reviews_customer_product').on(t.productId, t.customerId),
    productPublishedIdx: index('idx_product_reviews_product')
      .on(t.productId, t.createdAt)
      .where(sql`status = 'published'`),
    tenantStatusIdx: index('idx_product_reviews_tenant_status').on(t.tenantId, t.status),
  }),
);

export type ProductReview = typeof productReviews.$inferSelect;
export type NewProductReview = typeof productReviews.$inferInsert;
