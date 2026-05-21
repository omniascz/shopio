/**
 * `product_media` — per `06-catalog-pim.md` ENT-MEDIA-001 (link table).
 *
 * MVP: stores S3-style URLs + alt text directly. Production version
 * normalizes into separate `media` entity (per `06 §3.7`) — Fáze 2.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './products';
import { tenants } from './tenants';

export const productMedia = pgTable(
  'product_media',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(),                                                                                                                                                                                                                                                                                  // mda_ NanoID
    // Asset
    kind: text('kind', { enum: ['image', 'video', 'model_3d'] }).notNull().default('image'),
    url: text('url').notNull(),                                                                                                                                                                                                                                                                                              // CDN URL or S3 key
    alt: text('alt'),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    bytes: integer('bytes'),
    mimeType: text('mime_type'),
    // Display
    position: integer('position').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    productIdx: index('idx_product_media_product').on(t.productId, t.position),
  }),
);

export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
