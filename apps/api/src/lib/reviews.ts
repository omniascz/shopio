/**
 * Review aggregation helpers — per `19-marketing-seo.md`.
 * Pure-ish read helpers shared by storefront PDP + catalog + JSON-LD.
 */

import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema, type TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

export interface RatingSummary {
  count: number;
  /** Average to one decimal (e.g. 4.3); null when no reviews. */
  average: number | null;
}

/** Published rating summaries for a set of product ids (one query). */
export async function ratingSummaries(
  db: Db,
  productIds: string[],
): Promise<Map<string, RatingSummary>> {
  const map = new Map<string, RatingSummary>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({
      productId: schema.productReviews.productId,
      count: dsql<number>`COUNT(*)::int`,
      avg: dsql<string>`AVG(${schema.productReviews.rating})::numeric(3,2)::text`,
    })
    .from(schema.productReviews)
    .where(
      and(
        inArray(schema.productReviews.productId, productIds),
        eq(schema.productReviews.status, 'published'),
      ),
    )
    .groupBy(schema.productReviews.productId);
  for (const r of rows) {
    map.set(r.productId, {
      count: r.count,
      average: r.avg ? Math.round(Number(r.avg) * 10) / 10 : null,
    });
  }
  return map;
}

/** Single product summary (convenience). */
export async function ratingSummary(db: Db, productId: string): Promise<RatingSummary> {
  const m = await ratingSummaries(db, [productId]);
  return m.get(productId) ?? { count: 0, average: null };
}

/** Published reviews for a product, newest first. */
export async function listPublishedReviews(db: Db, productId: string, limit = 50) {
  return db
    .select({
      pubId: schema.productReviews.pubId,
      authorName: schema.productReviews.authorName,
      rating: schema.productReviews.rating,
      title: schema.productReviews.title,
      body: schema.productReviews.body,
      verifiedPurchase: schema.productReviews.verifiedPurchase,
      createdAt: schema.productReviews.createdAt,
    })
    .from(schema.productReviews)
    .where(
      and(
        eq(schema.productReviews.productId, productId),
        eq(schema.productReviews.status, 'published'),
      ),
    )
    .orderBy(desc(schema.productReviews.createdAt))
    .limit(limit);
}
