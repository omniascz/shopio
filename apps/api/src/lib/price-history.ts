/**
 * EU Omnibus price-history queries (per directive 2019/2161). When a product is
 * on sale, the storefront must show the lowest price of the prior 30 days. The
 * history rows are written by the `record_variant_price` DB trigger; here we
 * just read the 30-day minimum.
 */

import { and, eq, gte, inArray, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lowest recorded price per variant over the last 30 days (minor units).
 * Returns a map variantId → minPrice. Variants with no history are absent.
 * `now` is injected so the window is testable.
 */
export async function lowestPriceLast30Days(
  db: Db,
  tenantId: string,
  variantIds: string[],
  now: Date,
): Promise<Map<string, bigint>> {
  if (variantIds.length === 0) return new Map();
  const since = new Date(now.getTime() - THIRTY_DAYS_MS);
  const rows = await db
    .select({
      variantId: schema.variantPriceHistory.variantId,
      min: dsql<string>`min(${schema.variantPriceHistory.priceAmount})`,
    })
    .from(schema.variantPriceHistory)
    .where(
      and(
        eq(schema.variantPriceHistory.tenantId, tenantId),
        inArray(schema.variantPriceHistory.variantId, variantIds),
        gte(schema.variantPriceHistory.recordedAt, since),
      ),
    )
    .groupBy(schema.variantPriceHistory.variantId);
  return new Map(rows.map((r) => [r.variantId, BigInt(r.min)]));
}
