/**
 * `companies` — per `21-b2b-complete.md` MVP (ENT-COMPANIES).
 *
 * Minimal B2B slice: a customer attaches a company billing profile (IČO/DIČ/
 * address) to their account → invoices bill the company. The merchant can
 * grant NET payment terms per company (pay-on-invoice by bank transfer with a
 * due date) — off by default.
 *
 * Deferred (per `21`): credit limits + ledger, company_members roles/RBAC,
 * quotes/RFQ, purchase-order approval workflow, per-company price lists,
 * dunning, EU reverse-charge.
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const companies = pgTable(
  'companies',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // cmp_ NanoID
    name: text('name').notNull(),
    registrationNumber: text('registration_number'), // IČO
    vatId: text('vat_id'), // DIČ
    /** { line1, line2, city, postalCode, countryCode } */
    billingAddress: jsonb('billing_address'),
    /** Merchant-granted pay-on-invoice (NET terms). Off by default. */
    netTermsEnabled: boolean('net_terms_enabled').notNull().default(false),
    netTermsDays: integer('net_terms_days').notNull().default(14),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_companies_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_companies_tenant').on(t.tenantId),
  }),
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
