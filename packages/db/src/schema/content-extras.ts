/**
 * Content extras — glossary + poll (Shoptet "Slovník pojmů" + "Anketa").
 *
 * - glossary_terms: a term → definition list shown on the storefront.
 * - polls: one question with options + vote counts (options stored inline).
 */

import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const glossaryTerms = pgTable(
  'glossary_terms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // gls_ NanoID
    term: text('term').notNull(),
    slug: text('slug').notNull(),
    definitionHtml: text('definition_html').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('uq_glossary_terms_slug').on(t.tenantId, t.slug),
  }),
);

export const polls = pgTable(
  'polls',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // pol_ NanoID
    question: text('question').notNull(),
    /** [{ key, label, votes }] — vote counts incremented in place. */
    options: jsonb('options')
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_polls_pub_id').on(t.tenantId, t.pubId),
  }),
);

export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export interface PollOption {
  key: string;
  label: string;
  votes: number;
}
