/**
 * `tenants` — per `03-data-models-master.md` core entity.
 * Multi-tenant isolation root.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    pubId: text('pub_id').notNull(), // tnt_ NanoID
    slug: text('slug').notNull(), // URL-safe
    displayName: text('display_name').notNull(),
    legalEntityName: text('legal_entity_name'),
    // Geography
    countryCode: text('country_code').notNull(), // ISO 3166-1 alpha-2
    defaultLocale: text('default_locale').notNull().default('cs-CZ'), // BCP-47
    defaultCurrency: text('default_currency').notNull().default('CZK'), // ISO 4217
    timezone: text('timezone').notNull().default('Europe/Prague'),
    // Identification (CZ tax)
    registrationNumber: text('registration_number'), // IČO
    vatId: text('vat_id'), // DIČ / VAT
    // Tax engine config (per `15-tax-compliance.md`)
    /** CZ B2C convention: catalog prices are gross (VAT-inclusive). Engine extracts VAT. */
    priceIncludesTax: boolean('price_includes_tax').notNull().default(true),
    /** Tax class applied to shipping fees. */
    shippingTaxClass: text('shipping_tax_class').notNull().default('standard'),
    // Status
    status: text('status', { enum: ['provisioning', 'active', 'suspended', 'closing', 'closed'] })
      .notNull()
      .default('provisioning'),
    statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
    // Plan
    planTier: text('plan_tier', { enum: ['free', 'growth', 'scale', 'pro', 'enterprise'] })
      .notNull()
      .default('free'),
    // KMS
    kekArn: text('kek_arn'), // KMS key reference per `30 §7.4`
    // Settings (per `33-ai-features.md`, `36-personas-rbac.md`, etc. — JSONB blob)
    settings: jsonb('settings')
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_tenants_pub_id').on(t.pubId),
    slugUnique: uniqueIndex('uq_tenants_slug').on(t.slug),
    statusIdx: index('idx_tenants_status')
      .on(t.status)
      .where(sql`status IN ('active','provisioning')`),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
