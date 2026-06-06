/**
 * CMS content — `cms_pages` + `cms_blog_posts` per `32-cms-content.md` MVP
 * (ENT-CMS-PAGE-001, ENT-CMS-POST).
 *
 * The tight slice: static content pages (About / Terms / Privacy / Shipping /
 * FAQ) and a simple blog. Body is merchant-authored HTML rendered on the
 * storefront. Slug is unique per tenant; status gates public visibility.
 *
 * Deferred (per `32`): block/page builder, revisions, translations, forms +
 * submissions, FAQ as a distinct entity, menu builder, redirects manager,
 * scheduled publish, tags/categories, AI copy, approval workflow.
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const cmsPages = pgTable(
  'cms_pages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // pag_ NanoID
    slug: text('slug').notNull(), // [a-z0-9-], unique per tenant
    title: text('title').notNull(),
    bodyHtml: text('body_html').notNull().default(''),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('uq_cms_pages_slug').on(t.tenantId, t.slug),
    pubIdUnique: uniqueIndex('uq_cms_pages_pub_id').on(t.tenantId, t.pubId),
    tenantStatusIdx: index('idx_cms_pages_tenant_status').on(t.tenantId, t.status),
  }),
);

export const cmsBlogPosts = pgTable(
  'cms_blog_posts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // pst_ NanoID
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    bodyHtml: text('body_html').notNull().default(''),
    coverImageUrl: text('cover_image_url'),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('uq_cms_blog_posts_slug').on(t.tenantId, t.slug),
    pubIdUnique: uniqueIndex('uq_cms_blog_posts_pub_id').on(t.tenantId, t.pubId),
    tenantStatusIdx: index('idx_cms_blog_posts_tenant_status').on(
      t.tenantId,
      t.status,
      t.publishedAt,
    ),
  }),
);

export type CmsPage = typeof cmsPages.$inferSelect;
export type NewCmsPage = typeof cmsPages.$inferInsert;
export type CmsBlogPost = typeof cmsBlogPosts.$inferSelect;
export type NewCmsBlogPost = typeof cmsBlogPosts.$inferInsert;
