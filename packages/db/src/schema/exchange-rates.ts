/**
 * `exchange_rates` — daily FX reference rates (P1 multi-currency).
 *
 * Source: the Czech National Bank (ČNB) daily fixing — the standard CZ/SK
 * reference (Shoptet/Upgates both use it). A row says "`amount` units of
 * `currency` = `rate` CZK" (ČNB quotes against CZK), e.g. 1 EUR = 24.567 CZK.
 * Global reference data (not tenant-scoped, no RLS — like `tenants`).
 *
 * Conversion is done in `lib/fx`; this table just stores the latest fixing.
 */

import { integer, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    /** ISO 4217 code, e.g. 'EUR', 'PLN', 'USD'. CZK is implicit (the base). */
    currency: text('currency').primaryKey(),
    /** ČNB quotes some currencies per 100 units (HUF, JPY…). */
    amount: integer('amount').notNull().default(1),
    /** CZK per `amount` units (decimal, e.g. 24.567). */
    rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
    /** The ČNB fixing date this rate is for. */
    fixingDate: text('fixing_date').notNull(), // YYYY-MM-DD
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateIdx: uniqueIndex('uq_exchange_rates_currency').on(t.currency),
  }),
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
