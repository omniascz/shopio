/**
 * `tax_rates` — historized VAT/DPH rates per `15-tax-compliance.md` §3.2.
 *
 * Wave 1 MVP simplification: zone is collapsed to `country_code` directly
 * (no separate `tax_zones` table yet — added when EU/NON_EU multi-zone +
 * OSS land in a later wave). A rate is valid for a (tenant, country, class)
 * over a [valid_from, valid_until) window so VAT changes (e.g. CZ reduced
 * 15 % → 12 % in 2024) are captured cleanly and historical orders keep their
 * snapshotted rate (per RULE-TAX-006 / RULE-TAX-030).
 *
 * tax_class_code ∈ 'standard' | 'reduced' | 'super_reduced' | 'zero' | 'exempt'
 * CZ 2024+: standard 21 %, reduced 12 %, zero 0 %.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const taxRates = pgTable(
  'tax_rates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** ISO 3166-1 alpha-2 place-of-supply country this rate applies to. */
    countryCode: text('country_code').notNull(),
    /** Tax class this rate is for. */
    taxClassCode: text('tax_class_code').notNull(),
    /** Rate in basis points: 2100 = 21 %, 1200 = 12 %, 0 = 0 %. */
    rateBasisPoints: integer('rate_basis_points').notNull(),
    /** Human label, e.g. "DPH 21 %". */
    name: text('name').notNull(),
    /** Historization window — [valid_from, valid_until). */
    validFrom: date('valid_from').notNull(),
    validUntil: date('valid_until'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One rate per (tenant, country, class, valid_from) — re-seedable.
    uniqueWindow: uniqueIndex('uq_tax_rates_window').on(
      t.tenantId,
      t.countryCode,
      t.taxClassCode,
      t.validFrom,
    ),
    lookupIdx: index('idx_tax_rates_lookup').on(t.tenantId, t.countryCode, t.taxClassCode),
  }),
);

export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
