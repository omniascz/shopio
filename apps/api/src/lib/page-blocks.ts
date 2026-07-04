/**
 * Page-builder blocks (per `32-cms-content.md`) — a typed, ordered block model
 * for composing the homepage, CMS pages and landing pages without raw HTML.
 * Stored as a JSON array on `cms_pages.blocks` and in
 * `tenant.settings.homepage.blocks`.
 *
 * Two halves:
 *  - {@link BlocksSchema} validates merchant-authored block lists on write.
 *  - {@link resolveBlocks} enriches content-reference blocks (product grids,
 *    category showcases, buy buttons, column children) with live catalog data
 *    for the storefront on read, so the front-end just renders — no per-block
 *    fetching.
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

// ===== Leaf block schemas ====================================================
// "Leaf" = every block that cannot itself contain children. The `columns`
// layout block (below) nests these one level deep.

const heroBlock = z.object({
  id: z.string().max(40),
  type: z.literal('hero'),
  headline: z.string().max(200).default(''),
  subheadline: z.string().max(400).default(''),
  imageUrl: z.string().max(2000).nullable().default(null),
  ctaLabel: z.string().max(80).nullable().default(null),
  ctaHref: z.string().max(500).nullable().default(null),
  align,
});

const richTextBlock = z.object({
  id: z.string().max(40),
  type: z.literal('rich_text'),
  html: z.string().max(20000).default(''),
});

const imageBannerBlock = z.object({
  id: z.string().max(40),
  type: z.literal('image_banner'),
  imageUrl: z.string().max(2000),
  href: z.string().max(500).nullable().default(null),
  alt: z.string().max(255).default(''),
});

const productGridBlock = z.object({
  id: z.string().max(40),
  type: z.literal('product_grid'),
  title: z.string().max(200).default(''),
  productSlugs: z.array(z.string().max(160)).max(24).default([]),
});

const featuredCategoryBlock = z.object({
  id: z.string().max(40),
  type: z.literal('featured_category'),
  title: z.string().max(200).default(''),
  categorySlug: z.string().max(160),
  limit: z.number().int().min(1).max(24).default(8),
});

const newsletterBlock = z.object({
  id: z.string().max(40),
  type: z.literal('newsletter'),
  headline: z.string().max(200).default(''),
  subheadline: z.string().max(400).default(''),
});

const spacerBlock = z.object({
  id: z.string().max(40),
  type: z.literal('spacer'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
});

// --- New PageFlow-parity blocks ---------------------------------------------

/** Standalone heading (h2/h3) — structure a long landing page. */
const headingBlock = z.object({
  id: z.string().max(40),
  type: z.literal('heading'),
  text: z.string().max(200).default(''),
  level: z.enum(['h2', 'h3']).default('h2'),
  align,
});

/** Free CTA button pointing anywhere (unlike buy_button, no product bound). */
const buttonBlock = z.object({
  id: z.string().max(40),
  type: z.literal('button'),
  label: z.string().max(80).default(''),
  href: z.string().max(500).default('#'),
  variant: z.enum(['primary', 'outline']).default('primary'),
  align,
});

/** Direct-buy button: bound to a product by slug; resolves to a variant so the
 *  storefront can add-to-cart straight from the page (PageFlow "Do košíku"). */
const buyButtonBlock = z.object({
  id: z.string().max(40),
  type: z.literal('buy_button'),
  productSlug: z.string().max(160),
  label: z.string().max(80).default('Do košíku'),
  showPrice: z.boolean().default(true),
  align,
});

/** Multi-image grid. */
const galleryBlock = z.object({
  id: z.string().max(40),
  type: z.literal('gallery'),
  columns: z.number().int().min(2).max(4).default(3),
  images: z
    .array(
      z.object({
        url: z.string().max(2000),
        alt: z.string().max(255).default(''),
        href: z.string().max(500).nullable().default(null),
      }),
    )
    .max(24)
    .default([]),
});

/** Video embed — YouTube / Vimeo / direct file. `embedUrl` computed on resolve. */
const videoBlock = z.object({
  id: z.string().max(40),
  type: z.literal('video'),
  provider: z.enum(['youtube', 'vimeo', 'file']).default('youtube'),
  url: z.string().max(2000),
  caption: z.string().max(255).default(''),
});

/** FAQ accordion. Storefront also emits schema.org FAQPage markup (per `32`). */
const faqBlock = z.object({
  id: z.string().max(40),
  type: z.literal('faq'),
  title: z.string().max(200).default(''),
  items: z
    .array(
      z.object({
        q: z.string().max(300).default(''),
        a: z.string().max(2000).default(''),
      }),
    )
    .max(30)
    .default([]),
});

/** Customer testimonial / pull-quote. */
const testimonialBlock = z.object({
  id: z.string().max(40),
  type: z.literal('testimonial'),
  quote: z.string().max(1000).default(''),
  author: z.string().max(120).default(''),
  imageUrl: z.string().max(2000).nullable().default(null),
});

/** Every block that may appear at the top level *or* inside a `columns` child. */
const leafBlocks = [
  heroBlock,
  richTextBlock,
  imageBannerBlock,
  productGridBlock,
  featuredCategoryBlock,
  newsletterBlock,
  spacerBlock,
  headingBlock,
  buttonBlock,
  buyButtonBlock,
  galleryBlock,
  videoBlock,
  faqBlock,
  testimonialBlock,
] as const;

/** Leaf-only union — used for `columns` children (no nested columns). */
export const LeafBlockSchema = z.discriminatedUnion('type', [...leafBlocks]);

/** Layout container: 2–3 columns, each holding leaf blocks. One level deep. */
const columnsBlock = z.object({
  id: z.string().max(40),
  type: z.literal('columns'),
  columns: z.number().int().min(2).max(3).default(2),
  gap: z.enum(['sm', 'md', 'lg']).default('md'),
  children: z.array(LeafBlockSchema).max(12).default([]),
});

/**
 * Blocks allowed inside a *reusable section* (per `32` §4.6). Same as page
 * blocks minus `section_ref` — a section can't embed another section, which
 * keeps expansion non-recursive.
 */
export const SectionBlockSchema = z.discriminatedUnion('type', [...leafBlocks, columnsBlock]);
export const SectionBlocksSchema = z.array(SectionBlockSchema).max(50);

/** Reference to a global reusable section stored in the tenant's section
 * library (`settings.reusable_sections`). Dereferenced on resolve. */
const sectionRefBlock = z.object({
  id: z.string().max(40),
  type: z.literal('section_ref'),
  sectionKey: z.string().max(60),
});

/** Discriminated union of supported blocks. `id` is a client-stable key. */
export const BlockSchema = z.discriminatedUnion('type', [...leafBlocks, columnsBlock, sectionRefBlock]);

export const BlocksSchema = z.array(BlockSchema).max(50);
export type Block = z.infer<typeof BlockSchema>;
export type LeafBlock = z.infer<typeof LeafBlockSchema>;
export type SectionBlock = z.infer<typeof SectionBlockSchema>;

/** One entry in the tenant's reusable-section library. */
export interface SectionLibraryItem {
  key: string;
  name?: string;
  blocks: unknown;
}

/** Lenient HTML sanitizer for rich_text blocks (strip script + on* handlers). */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/** Normalize a video URL to an embeddable one (YouTube/Vimeo watch → embed). */
export function toEmbedUrl(provider: string, url: string): string {
  const u = url.trim();
  if (provider === 'youtube') {
    const m =
      u.match(/[?&]v=([\w-]{6,})/) ||
      u.match(/youtu\.be\/([\w-]{6,})/) ||
      u.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : u;
  }
  if (provider === 'vimeo') {
    const m = u.match(/vimeo\.com\/(?:video\/)?(\d{4,})/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : u;
  }
  return u; // file → used directly in <video src>
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

/** Resolve a buy_button's product slug → the card + first sellable variant so
 *  the storefront can add-to-cart directly. Null when the product is missing /
 *  inactive (block then renders as a dead CTA-free placeholder, dropped). */
async function loadBuyButton(
  db: Db,
  tenantId: string,
  slug: string,
): Promise<{
  slug: string;
  title: string;
  price: { amount: string; currency: string } | null;
  primary_image: { url: string; alt: string | null } | null;
  variant_id: string | null;
  in_stock: boolean;
} | null> {
  const [product] = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      title: schema.products.title,
      basePriceAmount: schema.products.basePriceAmount,
      basePriceCurrency: schema.products.basePriceCurrency,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.tenantId, tenantId),
        eq(schema.products.slug, slug),
        eq(schema.products.status, 'active'),
      ),
    )
    .limit(1);
  if (!product) return null;

  const [media, variants] = await Promise.all([
    db
      .select({ url: schema.productMedia.url, alt: schema.productMedia.alt })
      .from(schema.productMedia)
      .where(and(eq(schema.productMedia.productId, product.id), eq(schema.productMedia.position, 0)))
      .limit(1),
    db
      .select({
        pubId: schema.productVariants.pubId,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
        stockOnHand: schema.productVariants.stockOnHand,
        stockReserved: schema.productVariants.stockReserved,
        allowBackorder: schema.productVariants.allowBackorder,
        position: schema.productVariants.position,
      })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, product.id)),
  ]);

  // First by position = the merchant's default variant.
  const ordered = [...variants].sort((a, b) => a.position - b.position);
  const v = ordered[0] ?? null;
  const price = product.basePriceAmount
    ? { amount: product.basePriceAmount.toString(), currency: product.basePriceCurrency ?? 'CZK' }
    : v
      ? { amount: v.priceAmount.toString(), currency: v.priceCurrency }
      : null;
  const inStock = v ? v.stockOnHand - v.stockReserved > 0 || v.allowBackorder : false;
  const m = media[0];
  return {
    slug: product.slug,
    title: product.title,
    price,
    primary_image: m ? { url: m.url, alt: m.alt } : null,
    variant_id: v?.pubId ?? null,
    in_stock: inStock,
  };
}

/**
 * Resolve one block into render-ready data (the shared work between top-level
 * blocks and `columns` children). Returns null to drop the block entirely.
 */
async function resolveOne(
  db: Db,
  tenantId: string,
  b: LeafBlock,
): Promise<Record<string, unknown> | null> {
  if (b.type === 'rich_text') {
    return { ...b, html: sanitizeHtml(b.html) };
  }
  if (b.type === 'product_grid') {
    if (b.productSlugs.length === 0) return { ...b, products: [] };
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
    return { ...b, products: cards };
  }
  if (b.type === 'featured_category') {
    const [cat] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.tenantId, tenantId), eq(schema.categories.slug, b.categorySlug)))
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
    return { ...b, products };
  }
  if (b.type === 'buy_button') {
    const product = await loadBuyButton(db, tenantId, b.productSlug);
    if (!product) return null; // unknown/inactive product → drop the block
    return { ...b, product };
  }
  if (b.type === 'video') {
    return { ...b, embedUrl: toEmbedUrl(b.provider, b.url) };
  }
  return { ...b };
}

/** Resolve a non-reference block (leaf or `columns`) into render-ready data. */
async function resolveNonRef(
  db: Db,
  tenantId: string,
  b: SectionBlock,
): Promise<Record<string, unknown> | null> {
  if (b.type === 'columns') {
    const children: Array<Record<string, unknown>> = [];
    for (const child of b.children) {
      const resolved = await resolveOne(db, tenantId, child);
      if (resolved) children.push(resolved);
    }
    return { ...b, children };
  }
  return resolveOne(db, tenantId, b);
}

/**
 * Resolve a stored block list into a render-ready list for the storefront:
 * sanitize rich text, expand product_grid / featured_category / buy_button into
 * live catalog data, compute video embed URLs, recurse into `columns` children,
 * and dereference `section_ref` blocks against the tenant's reusable-section
 * library (per `32` §4.6). Unknown/invalid blocks are dropped defensively.
 */
export async function resolveBlocks(
  db: Db,
  tenantId: string,
  raw: unknown,
  library: SectionLibraryItem[] = [],
): Promise<Array<Record<string, unknown>>> {
  const parsed = BlocksSchema.safeParse(raw);
  if (!parsed.success) return [];
  const out: Array<Record<string, unknown>> = [];

  for (const b of parsed.data) {
    if (b.type === 'section_ref') {
      const sec = library.find((s) => s.key === b.sectionKey);
      if (!sec) continue; // unknown section → drop
      const secParsed = SectionBlocksSchema.safeParse(sec.blocks);
      if (!secParsed.success) continue;
      const children: Array<Record<string, unknown>> = [];
      for (const child of secParsed.data) {
        const resolved = await resolveNonRef(db, tenantId, child);
        if (resolved) children.push(resolved);
      }
      out.push({ id: b.id, type: 'section_ref', sectionKey: b.sectionKey, name: sec.name ?? '', children });
      continue;
    }
    const resolved = await resolveNonRef(db, tenantId, b);
    if (resolved) out.push(resolved);
  }
  return out;
}
