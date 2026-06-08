/**
 * Product recommendations (P2, per the Adobe Sensei / Einstein "frequently
 * bought together" + related patterns, built on our own order data — no ML).
 *
 *  - frequentlyBoughtTogether: products that co-occur in orders with the target.
 *  - related: active products sharing a category with the target.
 *
 * Both return render-ready product cards (price falls back to the cheapest
 * variant, like the page-builder grid).
 */

import { and, eq, inArray, ne, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  base_price: { amount: string; currency: string } | null;
  primary_image: { url: string; alt: string | null } | null;
}

/** Load render-ready cards for a set of internal product ids (order preserved). */
async function loadCards(db: Db, tenantId: string, productIds: string[]): Promise<ProductCard[]> {
  if (productIds.length === 0) return [];
  const [rows, media, variants] = await Promise.all([
    db
      .select({
        id: schema.products.id,
        pubId: schema.products.pubId,
        slug: schema.products.slug,
        title: schema.products.title,
        basePriceAmount: schema.products.basePriceAmount,
        basePriceCurrency: schema.products.basePriceCurrency,
      })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.tenantId, tenantId),
          eq(schema.products.status, 'active'),
          inArray(schema.products.id, productIds),
        ),
      ),
    db
      .select({ productId: schema.productMedia.productId, url: schema.productMedia.url, alt: schema.productMedia.alt })
      .from(schema.productMedia)
      .where(and(inArray(schema.productMedia.productId, productIds), eq(schema.productMedia.position, 0))),
    db
      .select({
        productId: schema.productVariants.productId,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
      })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.productId, productIds)),
  ]);

  const mediaBy = new Map(media.map((m) => [m.productId, m]));
  const minVar = new Map<string, { amount: bigint; currency: string }>();
  for (const v of variants) {
    const cur = minVar.get(v.productId);
    if (!cur || v.priceAmount < cur.amount) minVar.set(v.productId, { amount: v.priceAmount, currency: v.priceCurrency });
  }
  const order = new Map(productIds.map((id, i) => [id, i]));
  return rows
    .map((r) => {
      const m = mediaBy.get(r.id);
      const mv = minVar.get(r.id);
      const price = r.basePriceAmount
        ? { amount: r.basePriceAmount.toString(), currency: r.basePriceCurrency ?? 'CZK' }
        : mv
          ? { amount: mv.amount.toString(), currency: mv.currency }
          : null;
      return {
        _id: r.id,
        id: r.pubId,
        slug: r.slug,
        title: r.title,
        base_price: price,
        primary_image: m ? { url: m.url, alt: m.alt } : null,
      };
    })
    .sort((a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0))
    .map(({ _id, ...card }) => card);
}

/** Products most often bought in the same order as `productId`. */
export async function frequentlyBoughtTogether(
  db: Db,
  tenantId: string,
  productId: string,
  limit = 4,
): Promise<ProductCard[]> {
  const oi1 = schema.orderItems;
  // self-join order_items on the same order, counting co-occurring products.
  const rows = await db
    .select({
      productId: dsql<string>`oi2.product_id`,
      cnt: dsql<number>`count(distinct oi2.order_id)::int`,
    })
    .from(oi1)
    .innerJoin(
      dsql`${schema.orderItems} as oi2`,
      dsql`oi2.order_id = ${oi1.orderId} and oi2.product_id <> ${oi1.productId} and oi2.tenant_id = ${tenantId}`,
    )
    .where(and(eq(oi1.tenantId, tenantId), eq(oi1.productId, productId)))
    .groupBy(dsql`oi2.product_id`)
    .orderBy(dsql`count(distinct oi2.order_id) desc`)
    .limit(limit);
  return loadCards(db, tenantId, rows.map((r) => r.productId));
}

/** Active products sharing a category with `productId` (excluding itself). */
export async function relatedProducts(
  db: Db,
  tenantId: string,
  productId: string,
  limit = 4,
): Promise<ProductCard[]> {
  const cats = await db
    .select({ categoryId: schema.productCategories.categoryId })
    .from(schema.productCategories)
    .where(eq(schema.productCategories.productId, productId));
  if (cats.length === 0) return [];
  const rows = await db
    .selectDistinct({ productId: schema.productCategories.productId })
    .from(schema.productCategories)
    .where(
      and(
        inArray(schema.productCategories.categoryId, cats.map((c) => c.categoryId)),
        ne(schema.productCategories.productId, productId),
      ),
    )
    .limit(limit * 3);
  return (await loadCards(db, tenantId, rows.map((r) => r.productId))).slice(0, limit);
}
