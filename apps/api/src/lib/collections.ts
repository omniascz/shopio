/**
 * Dynamic collection resolution (P3). Turns a collection's rule object into the
 * matching active products, kept current automatically (no manual assignment).
 *
 * Rules (all that are set must hold): minPrice, maxPrice (effective price =
 * product base price, else cheapest variant), onSaleOnly, inStockOnly, brand,
 * vendor. sort: price_asc | price_desc | newest (default).
 */

import { and, asc, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';
import { loadCards, type ProductCard } from './recommendations';

type Db = AppDb | TenantTx;

export interface CollectionRules {
  minPrice?: number;
  maxPrice?: number;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  brand?: string;
  vendor?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest';
}

/** Effective price SQL: product base price, else the cheapest variant price. */
const EFF_PRICE = dsql`coalesce(${schema.products.basePriceAmount},
  (SELECT min(pv.price_amount) FROM product_variants pv WHERE pv.product_id = ${schema.products.id}))`;

/** Resolve a dynamic collection's matching products into render-ready cards. */
export async function resolveCollection(
  db: Db,
  tenantId: string,
  rules: CollectionRules,
  limit = 24,
): Promise<ProductCard[]> {
  const conds = [eq(schema.products.tenantId, tenantId), eq(schema.products.status, 'active')];
  if (rules.brand) conds.push(eq(schema.products.brandName, rules.brand));
  if (rules.vendor) conds.push(eq(schema.products.vendor, rules.vendor));
  if (rules.onSaleOnly) {
    conds.push(
      dsql`(${schema.products.compareAtAmount} IS NOT NULL OR EXISTS (
        SELECT 1 FROM product_variants pv WHERE pv.product_id = ${schema.products.id} AND pv.compare_at_amount IS NOT NULL))`,
    );
  }
  if (rules.inStockOnly) {
    conds.push(
      dsql`EXISTS (SELECT 1 FROM product_variants pv
        WHERE pv.product_id = ${schema.products.id} AND (pv.stock_on_hand - pv.stock_reserved) > 0)`,
    );
  }
  if (rules.minPrice != null) conds.push(dsql`${EFF_PRICE} >= ${rules.minPrice}`);
  if (rules.maxPrice != null) conds.push(dsql`${EFF_PRICE} <= ${rules.maxPrice}`);

  const orderBy =
    rules.sort === 'price_asc'
      ? dsql`${EFF_PRICE} ASC NULLS LAST`
      : rules.sort === 'price_desc'
        ? dsql`${EFF_PRICE} DESC NULLS LAST`
        : desc(schema.products.publishedAt);

  const rows = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(...conds))
    .orderBy(orderBy, asc(schema.products.id))
    .limit(limit);

  return loadCards(db, tenantId, rows.map((r) => r.id));
}
