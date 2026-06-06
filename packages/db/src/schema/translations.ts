/**
 * `translations` — universal content translation table per `23-i18n.md` MVP
 * (ENT-TRANSLATION-001).
 *
 * One row per (entity, field, locale) override. The master/source text stays
 * on the entity itself (products.title, categories.name, …); a translation row
 * only carries the localized value. Storefront resolution falls back
 * master ← exact locale ← language base (per `23 §4.1`).
 *
 * MVP scope: product + category text fields, manual entry. Deferred (per `23`):
 * versioning/history, AI auto-translation, import/export, translation memory,
 * UI-string keys, slugs per locale.
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const translations = pgTable(
  'translations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'product' | 'category' (extensible). */
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** Field name on the entity, e.g. 'title', 'description_html', 'name'. */
    field: text('field').notNull(),
    /** BCP-47 locale, e.g. 'en-US', 'de-DE', 'sk-SK'. */
    locale: text('locale').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('uq_translations_entity_field_locale').on(
      t.tenantId,
      t.entityType,
      t.entityId,
      t.field,
      t.locale,
    ),
    lookupIdx: index('idx_translations_lookup').on(
      t.tenantId,
      t.entityType,
      t.entityId,
      t.locale,
    ),
  }),
);

export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
