/**
 * Resolve active VAT rates from the DB for a place of supply at a point in time.
 *
 * Per `15-tax-compliance.md` §4 STAGE 3-4: rates are looked up by
 * (tenant, country, class) honoring the historization window
 * [valid_from, valid_until). When the ship-to country has no configured rates
 * (Wave 1 only seeds the merchant's own country), we fall back to the tenant's
 * home country — domestic VAT treatment. Proper EU/OSS multi-zone handling
 * arrives with the OSS wave.
 */

import { and, eq, lte, or, isNull, gt, sql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';
import type { ResolvedRate } from './tax';

/** Latest-valid rate per class for (tenant, country) at `at`. */
async function fetchRates(
  db: AppDb,
  tenantId: string,
  countryCode: string,
  at: Date,
): Promise<ResolvedRate[]> {
  const today = at.toISOString().slice(0, 10); // DATE comparison
  const rows = await db
    .select({
      taxClassCode: schema.taxRates.taxClassCode,
      rateBasisPoints: schema.taxRates.rateBasisPoints,
      validFrom: schema.taxRates.validFrom,
    })
    .from(schema.taxRates)
    .where(
      and(
        eq(schema.taxRates.tenantId, tenantId),
        eq(schema.taxRates.countryCode, countryCode),
        eq(schema.taxRates.isActive, true),
        lte(schema.taxRates.validFrom, today),
        or(isNull(schema.taxRates.validUntil), gt(schema.taxRates.validUntil, today)),
      ),
    )
    .orderBy(sql`${schema.taxRates.validFrom} DESC`);

  // Keep the most recent valid window per class.
  const byClass = new Map<string, ResolvedRate>();
  for (const row of rows) {
    if (!byClass.has(row.taxClassCode)) {
      byClass.set(row.taxClassCode, {
        taxClassCode: row.taxClassCode,
        rateBasisPoints: row.rateBasisPoints,
      });
    }
  }
  return [...byClass.values()];
}

/**
 * Resolve rates for the ship-to country, falling back to the tenant home country.
 */
export async function resolveRates(
  db: AppDb,
  tenantId: string,
  shipToCountry: string,
  tenantCountry: string,
  at: Date = new Date(),
): Promise<ResolvedRate[]> {
  const direct = await fetchRates(db, tenantId, shipToCountry.toUpperCase(), at);
  if (direct.length > 0) return direct;
  if (shipToCountry.toUpperCase() === tenantCountry.toUpperCase()) return direct;
  return fetchRates(db, tenantId, tenantCountry.toUpperCase(), at);
}
