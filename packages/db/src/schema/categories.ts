/**
 * `categories` — per `07-categories-taxonomy.md` ENT-CATEGORY-001.
 *
 * Uses Postgres `ltree` extension for materialized-path hierarchy.
 * MVP simplification: ltree column declared as text initially; promote to true
 * ltree column once we add GIST index in Fáze 1 wave 2.
 */

import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/** Postgres `ltree` type — materialized path. */
const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(),                                                                                                                                                                                                                                            // cat_ NanoID
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    // Hierarchy
    path: ltree('path').notNull(),                                                                                                                                                                                                                                                  // e.g. 'pottery.bowls.ceramic'
    parentId: uuid('parent_id'),                                                                                                                                                                                                                                                       // self-ref (no FK cycle — checked app-side)
    depth: integer('depth').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    // Display
    iconName: text('icon_name'),
    bannerMediaId: uuid('banner_media_id'),                                                                                                                                                                                                                                            // FK once `media` exists
    // SEO
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    // Status
    status: text('status', { enum: ['active', 'hidden', 'archived'] }).notNull().default('active'),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_categories_pub_id').on(t.tenantId, t.pubId),
    slugUnique: uniqueIndex('uq_categories_slug').on(t.tenantId, t.slug),
    pathUnique: uniqueIndex('uq_categories_path').on(t.tenantId, t.path),
    tenantStatusIdx: index('idx_categories_tenant_status').on(t.tenantId, t.status),
    parentIdx: index('idx_categories_parent').on(t.parentId).where(sql`parent_id IS NOT NULL`),
  }),
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
