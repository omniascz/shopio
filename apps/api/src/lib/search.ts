/**
 * Product search — Meilisearch per `08-search-filtering.md` MVP.
 *
 * Single `products` index, tenant-isolated via a mandatory `tenant_id`
 * filter (per `08 §6` multi-tenancy pattern). Documents are denormalized
 * product snapshots (variants → price range/sku list, media → primary image,
 * categories → names+slugs).
 *
 * Resilience: every call is best-effort — when Meilisearch is unconfigured
 * or down, indexing no-ops and the storefront search endpoint falls back to
 * the Postgres ILIKE path, so search never takes checkout down with it.
 *
 * Deferred: typo/synonym tuning, facets UI, pgvector semantic search,
 * BullMQ-driven reindex jobs (JOB-INDEX-PATCH-STOCK et al).
 */

import { Meilisearch } from 'meilisearch';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const INDEX_UID = 'products';

let _client: Meilisearch | null = null;
let _settingsApplied = false;

export function getMeili(config: ShopioConfig): Meilisearch | null {
  if (!config.MEILISEARCH_HOST) return null;
  if (_client) return _client;
  _client = new Meilisearch({
    host: config.MEILISEARCH_HOST,
    ...(config.MEILISEARCH_API_KEY && { apiKey: config.MEILISEARCH_API_KEY }),
  });
  return _client;
}

export function isSearchEnabled(config: ShopioConfig): boolean {
  return Boolean(config.MEILISEARCH_HOST);
}

async function ensureIndexSettings(config: ShopioConfig): Promise<Meilisearch | null> {
  const client = getMeili(config);
  if (!client) return null;
  if (_settingsApplied) return client;
  const index = client.index(INDEX_UID);
  await index.updateSettings({
    searchableAttributes: ['title', 'description_text', 'sku_list', 'vendor', 'brand', 'category_names'],
    filterableAttributes: ['tenant_id', 'status', 'in_stock', 'category_slugs'],
    sortableAttributes: ['price_min', 'updated_at_ts'],
    displayedAttributes: ['id', 'pub_id', 'slug', 'title', 'price_min', 'price_max', 'currency', 'in_stock', 'primary_image_url'],
  });
  _settingsApplied = true;
  return client;
}

interface ProductDocument {
  id: string; // product uuid (Meili primary key)
  tenant_id: string;
  pub_id: string;
  slug: string;
  title: string;
  description_text: string;
  vendor: string | null;
  brand: string | null;
  status: string;
  currency: string | null;
  price_min: number | null;
  price_max: number | null;
  in_stock: boolean;
  primary_image_url: string | null;
  sku_list: string[];
  category_slugs: string[];
  category_names: string[];
  updated_at_ts: number;
}

function stripHtml(html: string | null): string {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

/** Build the denormalized search document for one product. */
export async function buildProductDocument(
  db: AppDb,
  productId: string,
): Promise<ProductDocument | null> {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);
  if (!product) return null;

  const [variants, media, cats] = await Promise.all([
    db
      .select({
        sku: schema.productVariants.sku,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
        stockOnHand: schema.productVariants.stockOnHand,
        stockReserved: schema.productVariants.stockReserved,
        allowBackorder: schema.productVariants.allowBackorder,
      })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, product.id)),
    db
      .select({ url: schema.productMedia.url, isPrimary: schema.productMedia.isPrimary })
      .from(schema.productMedia)
      .where(eq(schema.productMedia.productId, product.id))
      .orderBy(asc(schema.productMedia.position)),
    db
      .select({ slug: schema.categories.slug, name: schema.categories.name })
      .from(schema.productCategories)
      .innerJoin(schema.categories, eq(schema.categories.id, schema.productCategories.categoryId))
      .where(eq(schema.productCategories.productId, product.id)),
  ]);

  const prices = variants.map((v) => Number(v.priceAmount));
  const inStock = variants.some(
    (v) => v.stockOnHand - v.stockReserved > 0 || v.allowBackorder,
  );

  return {
    id: product.id,
    tenant_id: product.tenantId,
    pub_id: product.pubId,
    slug: product.slug,
    title: product.title,
    description_text: stripHtml(product.descriptionHtml),
    vendor: product.vendor,
    brand: product.brandName,
    status: product.status,
    currency: variants[0]?.priceCurrency ?? product.basePriceCurrency,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    in_stock: inStock,
    primary_image_url: media.find((m) => m.isPrimary)?.url ?? media[0]?.url ?? null,
    sku_list: variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
    category_slugs: cats.map((c) => c.slug),
    category_names: cats.map((c) => c.name),
    updated_at_ts: product.updatedAt.getTime(),
  };
}

/** Best-effort (re)index of one product — never throws. */
export async function indexProduct(
  config: ShopioConfig,
  db: AppDb,
  productId: string,
  log?: FastifyBaseLogger,
): Promise<void> {
  try {
    const client = await ensureIndexSettings(config);
    if (!client) return;
    const doc = await buildProductDocument(db, productId);
    if (!doc) return;
    if (doc.status === 'archived') {
      await client.index(INDEX_UID).deleteDocument(doc.id);
      return;
    }
    await client.index(INDEX_UID).addDocuments([doc], { primaryKey: 'id' });
  } catch (err) {
    log?.warn({ err, productId }, 'search.index_failed');
  }
}

/** Best-effort removal — never throws. */
export async function removeProductFromIndex(
  config: ShopioConfig,
  productId: string,
  log?: FastifyBaseLogger,
): Promise<void> {
  try {
    const client = getMeili(config);
    if (!client) return;
    await client.index(INDEX_UID).deleteDocument(productId);
  } catch (err) {
    log?.warn({ err, productId }, 'search.remove_failed');
  }
}

/** Reindex every product of a tenant (admin action / initial backfill). */
export async function reindexTenant(
  config: ShopioConfig,
  db: AppDb,
  tenantId: string,
  log?: FastifyBaseLogger,
): Promise<number> {
  const client = await ensureIndexSettings(config);
  if (!client) return 0;
  const ids = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.tenantId, tenantId));
  let count = 0;
  const docs: ProductDocument[] = [];
  for (const { id } of ids) {
    const doc = await buildProductDocument(db, id);
    if (doc && doc.status !== 'archived') {
      docs.push(doc);
      count += 1;
    }
  }
  if (docs.length) {
    await client.index(INDEX_UID).addDocuments(docs, { primaryKey: 'id' });
  }
  log?.info({ tenantId, count }, 'search.reindex_complete');
  return count;
}

export interface SearchHit {
  productId: string;
  slug: string;
  title: string;
}

/**
 * Tenant-scoped full-text search. Returns null when Meilisearch is
 * unavailable (callers fall back to the DB path).
 */
export async function searchProducts(
  config: ShopioConfig,
  params: {
    tenantId: string;
    q: string;
    categorySlug?: string | undefined;
    limit: number;
    offset: number;
  },
  log?: FastifyBaseLogger,
): Promise<{ ids: string[]; total: number } | null> {
  try {
    const client = await ensureIndexSettings(config);
    if (!client) return null;
    const filter = [
      `tenant_id = "${params.tenantId}"`,
      `status = "active"`,
      ...(params.categorySlug ? [`category_slugs = "${params.categorySlug}"`] : []),
    ];
    const res = await client.index(INDEX_UID).search(params.q, {
      filter,
      limit: params.limit,
      offset: params.offset,
      attributesToRetrieve: ['id'],
    });
    return {
      ids: res.hits.map((h) => String((h as Record<string, unknown>).id)),
      total: res.estimatedTotalHits ?? res.hits.length,
    };
  } catch (err) {
    log?.warn({ err }, 'search.query_failed_fallback_db');
    return null;
  }
}

/** Resolve product rows for search hit ids, preserving relevance order. */
export async function fetchProductsByIds(db: AppDb, tenantId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.tenantId, tenantId), inArray(schema.products.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
}
