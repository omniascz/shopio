/**
 * Page-builder blocks (per `32-cms-content.md`) — a typed, ordered block model
 * for composing the homepage and CMS pages without raw HTML. Stored as a JSON
 * array on `cms_pages.blocks` and in `tenant.settings.homepage.blocks`.
 *
 * Two halves:
 *  - {@link BlocksSchema} validates merchant-authored block lists on write.
 *  - {@link resolveBlocks} enriches content-reference blocks (product grids,
 *    category showcases) with live catalog data for the storefront on read,
 *    so the front-end just renders — no per-block fetching.
 *
 * Rich-text HTML is sanitized (script/handlers stripped) — same lenient pass
 * the CMS body uses.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

const align = z.enum(['left', 'center', 'right']).default('center');

/** Discriminated union of supported blocks. `id` is a client-stable key. */
export const BlockSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().max(40),
    type: z.literal('hero'),
    headline: z.string().max(200).default(''),
    subheadline: z.string().max(400).default(''),
    imageUrl: z.string().max(2000).nullable().default(null),
    ctaLabel: z.string().max(80).nullable().default(null),
    ctaHref: z.string().max(500).nullable().default(null),
    align,
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('rich_text'),
    html: z.string().max(20000).default(''),
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('image_banner'),
    imageUrl: z.string().max(2000),
    href: z.string().max(500).nullable().default(null),
    alt: z.string().max(255).default(''),
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('product_grid'),
    title: z.string().max(200).default(''),
    productSlugs: z.array(z.string().max(160)).max(24).default([]),
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('featured_category'),
    title: z.string().max(200).default(''),
    categorySlug: z.string().max(160),
    limit: z.number().int().min(1).max(24).default(8),
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('newsletter'),
    headline: z.string().max(200).default(''),
    subheadline: z.string().max(400).default(''),
  }),
  z.object({
    id: z.string().max(40),
    type: z.literal('spacer'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
]);

export const BlocksSchema = z.array(BlockSchema).max(50);
export type Block = z.infer<typeof BlockSchema>;

/** Lenient HTML sanitizer for rich_text blocks (strip script + on* handlers). */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

interface ProductCard {
  id: string;
  slug: string;
  title: string;
  base_price: { amount: string; currency: string } | null;
  primary_image: { url: string; alt: string | null } | null;
}

async function loadProductCards(
  db: Db,
  tenantId: string,
  where: ReturnType<typeof and>,
  limit: number,
): Promise<ProductCard[]> {
  const rows = await db
    .select({
      id: schema.products.id,
      pubId: schema.products.pubId,
      slug: schema.products.slug,
      title: schema.products.title,
      basePriceAmount: schema.products.basePriceAmount,
      basePriceCurrency: schema.products.basePriceCurrency,
    })
    .from(schema.products)
    .where(where)
    .limit(limit);
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.id);
  const [media, variants] = await Promise.all([
    db
      .select({
        productId: schema.productMedia.productId,
        url: schema.productMedia.url,
        alt: schema.productMedia.alt,
      })
      .from(schema.productMedia)
      .where(and(inArray(schema.productMedia.productId, productIds), eq(schema.productMedia.position, 0))),
    // Cheapest variant per product → the real sellable price when the product
    // carries no base price (variant-priced catalog, the common case).
    db
      .select({
        productId: schema.productVariants.productId,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
      })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.productId, productIds)),
  ]);
  const mediaByProduct = new Map(media.map((m) => [m.productId, m]));
  const minVariant = new Map<string, { amount: bigint; currency: string }>();
  for (const v of variants) {
    const cur = minVariant.get(v.productId);
    if (!cur || v.priceAmount < cur.amount) {
      minVariant.set(v.productId, { amount: v.priceAmount, currency: v.priceCurrency });
    }
  }

  return rows.map((r) => {
    const m = mediaByProduct.get(r.id);
    const mv = minVariant.get(r.id);
    const price = r.basePriceAmount
      ? { amount: r.basePriceAmount.toString(), currency: r.basePriceCurrency ?? 'CZK' }
      : mv
        ? { amount: mv.amount.toString(), currency: mv.currency }
        : null;
    return {
      id: r.pubId,
      slug: r.slug,
      title: r.title,
      base_price: price,
      primary_image: m ? { url: m.url, alt: m.alt } : null,
    };
  });
}

/**
 * Resolve a stored block list into a render-ready list for the storefront:
 * sanitize rich text, expand product_grid (by slug, preserving author order)
 * and featured_category (active products in the category) into product cards.
 * Unknown/invalid blocks are dropped defensively.
 */
export async function resolveBlocks(
  db: Db,
  tenantId: string,
  raw: unknown,
): Promise<Array<Record<string, unknown>>> {
  const parsed = BlocksSchema.safeParse(raw);
  if (!parsed.success) return [];
  const blocks = parsed.data;
  const out: Array<Record<string, unknown>> = [];

  for (const b of blocks) {
    if (b.type === 'rich_text') {
      out.push({ ...b, html: sanitizeHtml(b.html) });
      continue;
    }
    if (b.type === 'product_grid') {
      if (b.productSlugs.length === 0) {
        out.push({ ...b, products: [] });
        continue;
      }
      const cards = await loadProductCards(
        db,
        tenantId,
        and(
          eq(schema.products.tenantId, tenantId),
          eq(schema.products.status, 'active'),
          inArray(schema.products.slug, b.productSlugs),
        ),
        b.productSlugs.length,
      );
      // Preserve the author's slug order.
      const order = new Map(b.productSlugs.map((s, idx) => [s, idx]));
      cards.sort((x, y) => (order.get(x.slug) ?? 0) - (order.get(y.slug) ?? 0));
      out.push({ ...b, products: cards });
      continue;
    }
    if (b.type === 'featured_category') {
      const [cat] = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(eq(schema.categories.tenantId, tenantId), eq(schema.categories.slug, b.categorySlug)),
        )
        .limit(1);
      let products: ProductCard[] = [];
      if (cat) {
        const ids = await db
          .select({ productId: schema.productCategories.productId })
          .from(schema.productCategories)
          .where(eq(schema.productCategories.categoryId, cat.id))
          .limit(b.limit);
        if (ids.length > 0) {
          products = await loadProductCards(
            db,
            tenantId,
            and(
              eq(schema.products.tenantId, tenantId),
              eq(schema.products.status, 'active'),
              inArray(
                schema.products.id,
                ids.map((i) => i.productId),
              ),
            ),
            b.limit,
          );
        }
      }
      out.push({ ...b, products });
      continue;
    }
    out.push({ ...b });
  }
  return out;
}
