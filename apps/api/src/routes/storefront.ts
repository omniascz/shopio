/**
 * Public storefront API — no auth required.
 *
 * Per `04-api-conventions.md` storefront API conventions
 * + `22-multistore-channels.md` (tenant resolution via slug for MVP;
 *   production: per-hostname routing).
 *
 * Endpoints (all public, only `active` products visible):
 *   GET /api/{date}/storefront/{tenantSlug}/products
 *   GET /api/{date}/storefront/{tenantSlug}/products/{productSlug}
 *   GET /api/{date}/storefront/{tenantSlug}/categories
 *   GET /api/{date}/storefront/{tenantSlug}                              — tenant info (display_name, locale, currency)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { searchProducts } from '../lib/search';
import { listPublishedReviews, ratingSummaries, ratingSummary } from '../lib/reviews';
import { facetDistribution } from '../lib/search';
import { loadTranslations, resolveServeLocale } from '../lib/translations';
import {
  buildAiFeed,
  buildCeneoFeed,
  buildFeedXml,
  buildGoogleFeed,
  loadFeedItems,
  type FeedProvider,
} from '../lib/feeds';
import { checkBalance as checkGiftCardBalance } from '../lib/gift-cards';
import { bundleAvailableQuantity, loadBundleComponents } from '../lib/bundles';
import { resolveBlocks, type SectionLibraryItem } from '../lib/page-blocks';
import { lowestPriceLast30Days } from '../lib/price-history';
import { bestSellers, frequentlyBoughtTogether, relatedProducts } from '../lib/recommendations';
import { addStockWatch } from '../lib/stock-watch';
import { resolveCollection, type CollectionRules } from '../lib/collections';
import { subscribe as subscribeNewsletter, unsubscribeByToken } from '../lib/newsletter';
import { loadRates } from '../lib/fx';
import {
  makeConverter,
  readCurrencyConfig,
  resolvePresentmentCurrency,
  supportedCurrencies,
} from '../lib/presentment';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const ListQuery = z.object({
  q: z.string().max(255).optional(),
  categorySlug: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'oldest', 'title']).default('recent'),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerStorefrontRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug} — tenant info
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const s = (tenant.settings ?? {}) as {
        appearance?: {
          theme?: string;
          accent_color?: string;
          secondary_color?: string;
          font?: string;
          radius?: string;
          logo_url?: string;
        };
        homepage?: {
          announcement?: Record<string, unknown>;
          hero?: Record<string, unknown>;
          popup?: Record<string, unknown>;
        };
        integrations?: { ga4_measurement_id?: string | null; meta_pixel_id?: string | null };
        currencies?: { presentment?: string[] };
      };
      const appearance = s.appearance;
      const currencyCfg = readCurrencyConfig(tenant.defaultCurrency, tenant.settings);

      return reply.send({
        data: {
          tenant: {
            id: tenant.pubId,
            slug: tenant.slug,
            display_name: tenant.displayName,
            default_locale: tenant.defaultLocale,
            enabled_locales: (tenant.enabledLocales as string[]) ?? [tenant.defaultLocale],
            default_currency: tenant.defaultCurrency,
            // Presentment currencies (P1) — base first; storefront shows a
            // switcher and passes ?currency= to catalog endpoints.
            supported_currencies: supportedCurrencies(currencyCfg),
            country_code: tenant.countryCode,
            appearance: {
              theme: appearance?.theme ?? 'minimal',
              accent_color: appearance?.accent_color ?? '#111111',
              secondary_color: appearance?.secondary_color ?? '#0066ff',
              font: appearance?.font ?? 'sans',
              radius: appearance?.radius ?? 'soft',
              logo_url: appearance?.logo_url ?? null,
            },
            homepage: {
              announcement: s.homepage?.announcement ?? { enabled: false },
              hero: s.homepage?.hero ?? { enabled: false },
              popup: s.homepage?.popup ?? { enabled: false },
            },
            analytics: {
              ga4_measurement_id: s.integrations?.ga4_measurement_id ?? null,
              meta_pixel_id: s.integrations?.meta_pixel_id ?? null,
            },
          },
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/payment-methods — enabled methods for checkout
  // (per `13 §4.4`). Public: only the customer-safe fields, ordered by priority.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/payment-methods',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const rows = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select({
            code: schema.paymentProviderConfigs.providerCode,
            displayName: schema.paymentProviderConfigs.displayName,
            priority: schema.paymentProviderConfigs.priority,
            methodKinds: schema.paymentProviderConfigs.supportedMethodKinds,
            currencies: schema.paymentProviderConfigs.supportedCurrencies,
          })
          .from(schema.paymentProviderConfigs)
          .where(
            and(
              eq(schema.paymentProviderConfigs.tenantId, tenant.id),
              eq(schema.paymentProviderConfigs.isEnabled, true),
            ),
          )
          .orderBy(desc(schema.paymentProviderConfigs.priority)),
      );

      const OFFLINE = new Set(['cod', 'bank_transfer']);
      const methods = rows
        .filter((r) => (r.currencies ?? []).length === 0 || r.currencies!.includes(tenant.defaultCurrency))
        .map((r) => ({
          code: r.code,
          display_name: r.displayName,
          kind: OFFLINE.has(r.code) ? 'offline' : 'redirect',
        }));

      return reply.send({ data: { methods } });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/gift-cards/check-balance — validate a code →
  // masked balance (per `10` §7.5). Public; rate-limited against brute force
  // (the code space is large but we cap attempts per IP).
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string }; Body: { code?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/gift-cards/check-balance',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const code = (req.body?.code ?? '').trim();
      if (code.length < 4 || code.length > 40) return notFound(reply, 'gift_card');
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const result = await withTenant(rlsDb, tenant.id, (tx) =>
        checkGiftCardBalance(tx, tenant.id, code),
      );
      if (!result.found || result.status !== 'active') return notFound(reply, 'gift_card');
      return reply.send({
        data: {
          status: result.status,
          balance: result.balance?.toString(),
          currency: result.currency,
          masked: `${result.codePrefix}-…-${result.codeLast4}`,
          expires_at: result.expiresAt,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/resolve-domain?host= — map a custom domain → tenant slug
  // (per `22`). Public, used by the storefront middleware for host-based routing.
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: { host?: string } }>(
    '/api/2026-05-20/storefront/resolve-domain',
    async (req, reply) => {
      const host = (req.query.host ?? '').toLowerCase().replace(/:\d+$/, '').trim();
      if (!host) return notFound(reply, 'domain');
      const [row] = await db
        .select({ slug: schema.tenants.slug })
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.status, 'active'),
            dsql`lower(${schema.tenants.settings} ->> 'custom_domain') = ${host}`,
          ),
        )
        .limit(1);
      if (!row) return notFound(reply, 'domain');
      return reply
        .header('cache-control', 'public, max-age=300')
        .send({ data: { slug: row.slug } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/feeds/{provider}.xml — comparison-shopping
  // feed, per `29-integrations.md`. Public XML the merchant registers in the
  // engine's admin. CZ: Heureka / Zboží.cz / Glami; global: Google Shopping
  // (RSS+g:); PL: Ceneo. Market acquisition essential.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; provider: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/feeds/:provider.xml',
    async (req, reply) => {
      const providerRaw = req.params.provider;
      const cz: FeedProvider[] = ['heureka', 'zbozi', 'glami'];
      const isCz = cz.includes(providerRaw as FeedProvider);
      const isGoogle = providerRaw === 'google';
      const isCeneo = providerRaw === 'ceneo';
      if (!isCz && !isGoogle && !isCeneo) {
        return notFound(reply, 'feed');
      }
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const items = await loadFeedItems(rlsDb, {
        id: tenant.id,
        slug: tenant.slug,
        countryCode: tenant.countryCode,
        defaultCurrency: tenant.defaultCurrency,
        priceIncludesTax: tenant.priceIncludesTax,
      });
      const xml = isGoogle
        ? buildGoogleFeed(items, config.SHOPIO_BASE_URL, tenant.slug)
        : isCeneo
          ? buildCeneoFeed(items, config.SHOPIO_BASE_URL, tenant.slug)
          : buildFeedXml(providerRaw as FeedProvider, items, config.SHOPIO_BASE_URL, tenant.slug);
      return reply
        .header('content-type', 'application/xml; charset=utf-8')
        .header('cache-control', 'public, max-age=3600')
        .send(xml);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/feeds/ai.json — AI / agentic-commerce product
  // feed (2026 trend). Structured JSON catalog for LLM shopping agents (ChatGPT,
  // Gemini, Perplexity, Copilot) and the storefront's llms.txt. Real-time price
  // + availability — the open counterpart to agentic catalogs.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/feeds/ai.json',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const items = await loadFeedItems(rlsDb, {
        id: tenant.id,
        slug: tenant.slug,
        countryCode: tenant.countryCode,
        defaultCurrency: tenant.defaultCurrency,
        priceIncludesTax: tenant.priceIncludesTax,
      });
      const json = buildAiFeed(items, config.SHOPIO_BASE_URL, tenant.slug, tenant.displayName ?? tenant.slug);
      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('cache-control', 'public, max-age=1800')
        .send(json);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/categories
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/categories',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      // i18n (per `23`): apply locale overrides for name/description.
      const locale = resolveServeLocale(
        requestedLocale(req),
        (tenant.enabledLocales as string[]) ?? [],
        tenant.defaultLocale,
      );
      const { rows, tr } = await withTenant(rlsDb, tenant.id, async (tx) => {
        const catRows = await tx
          .select({
            id: schema.categories.id,
            pubId: schema.categories.pubId,
            slug: schema.categories.slug,
            name: schema.categories.name,
            description: schema.categories.description,
            path: schema.categories.path,
            parentId: schema.categories.parentId,
            depth: schema.categories.depth,
          })
          .from(schema.categories)
          .where(
            and(eq(schema.categories.tenantId, tenant.id), eq(schema.categories.status, 'active')),
          )
          .orderBy(asc(schema.categories.path), asc(schema.categories.sortOrder));
        const trans = await loadTranslations(
          tx,
          tenant.id,
          'category',
          catRows.map((r) => r.id),
          locale,
          tenant.defaultLocale,
        );
        return { rows: catRows, tr: trans };
      });

      return reply.send({
        data: {
          locale,
          categories: rows.map((r) => {
            const o = tr.get(r.id);
            return {
              id: r.pubId,
              slug: r.slug,
              name: o?.get('name') ?? r.name,
              description: o?.get('description') ?? r.description,
              path: r.path,
              depth: r.depth,
              parent_id: r.parentId,
            };
          }),
          count: rows.length,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/products
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string }; Querystring: { currency?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const present = await buildPresenter(db, tenant, req.query.currency);

      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_FAILED', message: 'Invalid query params' },
        });
      }
      const { q, categorySlug, limit, offset, sort } = parsed.data;

      // Facet filters from query: `facet.Materiál=Kamenina` (repeat or
      // comma-separate for multi-value). Per `08` facet semantics.
      const facets: Record<string, string[]> = {};
      for (const [key, raw] of Object.entries(req.query as Record<string, unknown>)) {
        if (!key.startsWith('facet.')) continue;
        const name = key.slice('facet.'.length);
        const values = (Array.isArray(raw) ? raw : [raw])
          .flatMap((v) => String(v).split(','))
          .map((v) => v.trim())
          .filter(Boolean);
        if (values.length) facets[name] = values;
      }
      const hasFacets = Object.keys(facets).length > 0;

      // Full-text / facet path (per `08`): Meilisearch when configured +
      // reachable; hit ids resolved back to rows. Falls back to ILIKE below
      // when search is unavailable (facets then ignored — DB has no index).
      let searchIds: string[] | null = null;
      if (q || hasFacets) {
        const hits = await searchProducts(
          config,
          { tenantId: tenant.id, q: q ?? '', categorySlug, facets, limit, offset },
          app.log,
        );
        if (hits) searchIds = hits.ids;
      }

      // Filter: only active + published products
      const conditions = [
        eq(schema.products.tenantId, tenant.id),
        eq(schema.products.status, 'active'),
        dsql`${schema.products.publishedAt} IS NOT NULL`,
      ];
      if (searchIds) {
        if (searchIds.length === 0) {
          return reply.send({ data: { products: [], count: 0, offset, limit } });
        }
        conditions.push(inArray(schema.products.id, searchIds));
      } else if (q) {
        conditions.push(
          dsql`(${schema.products.title} ILIKE ${'%' + q + '%'} OR ${schema.products.slug} ILIKE ${'%' + q + '%'})`,
        );
      }

      const order =
        sort === 'recent'
          ? desc(schema.products.publishedAt)
          : sort === 'oldest'
            ? asc(schema.products.publishedAt)
            : asc(schema.products.title);
      const cols = {
        id: schema.products.id,
        pubId: schema.products.pubId,
        slug: schema.products.slug,
        title: schema.products.title,
        basePriceAmount: schema.products.basePriceAmount,
        basePriceCurrency: schema.products.basePriceCurrency,
        vendor: schema.products.vendor,
        brandName: schema.products.brandName,
        publishedAt: schema.products.publishedAt,
      };
      const locale = resolveServeLocale(
        requestedLocale(req),
        (tenant.enabledLocales as string[]) ?? [],
        tenant.defaultLocale,
      );

      // All tenant-scoped reads under one RLS transaction.
      const loaded = await withTenant(rlsDb, tenant.id, async (tx) => {
        let categoryId: string | undefined;
        if (categorySlug) {
          const [cat] = await tx
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(
              and(
                eq(schema.categories.tenantId, tenant.id),
                eq(schema.categories.slug, categorySlug),
              ),
            )
            .limit(1);
          if (!cat) return null;
          categoryId = cat.id;
        }

        const baseQuery = categoryId
          ? tx
              .select(cols)
              .from(schema.products)
              .innerJoin(
                schema.productCategories,
                eq(schema.productCategories.productId, schema.products.id),
              )
              .where(and(...conditions, eq(schema.productCategories.categoryId, categoryId)))
          : tx.select(cols).from(schema.products).where(and(...conditions));

        // Meilisearch already paginated the hit set — don't offset twice.
        const productRows = await baseQuery
          .orderBy(order)
          .limit(limit)
          .offset(searchIds ? 0 : offset);

        const ids = productRows.map((r) => r.id);
        const media = ids.length
          ? await tx
              .select({
                productId: schema.productMedia.productId,
                url: schema.productMedia.url,
                alt: schema.productMedia.alt,
              })
              .from(schema.productMedia)
              .where(
                and(
                  inArray(schema.productMedia.productId, ids),
                  eq(schema.productMedia.position, 0),
                ),
              )
          : [];
        const ratingMap = await ratingSummaries(tx, ids);
        const trans = await loadTranslations(tx, tenant.id, 'product', ids, locale, tenant.defaultLocale);
        const [facetNamesRow] = await tx
          .select({
            names: dsql<string[]>`COALESCE(ARRAY_AGG(DISTINCT elem->>'name') FILTER (WHERE elem->>'name' IS NOT NULL), '{}')`,
          })
          .from(schema.products)
          .leftJoin(
            dsql`LATERAL jsonb_array_elements(${schema.products.attributes}) AS elem`,
            dsql`true`,
          )
          .where(
            and(eq(schema.products.tenantId, tenant.id), eq(schema.products.status, 'active')),
          );
        return { productRows, media, ratingMap, trans, facetNamesRow };
      });
      if (loaded === null) return notFound(reply, 'category');
      const { productRows: rows, media: primaryMedia, ratingMap: ratings, trans: tr, facetNamesRow } =
        loaded;
      const mediaByProduct = new Map(primaryMedia.map((m) => [m.productId, m]));

      // Available filters for the sidebar: distinct attribute names across the
      // tenant's active catalog → Meili facet distribution for the current view.
      let facetFilters: { name: string; values: { value: string; count: number }[] }[] = [];
      const facetNames = facetNamesRow?.names ?? [];
      if (facetNames.length > 0) {
        const dist = await facetDistribution(
          config,
          { tenantId: tenant.id, q: q ?? '', categorySlug, facets, facetNames },
          app.log,
        );
        if (dist) {
          facetFilters = facetNames
            .map((name) => ({
              name,
              values: Object.entries(dist[name] ?? {})
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count),
            }))
            .filter((f) => f.values.length > 0);
        }
      }

      return reply.send({
        data: {
          locale,
          products: rows.map((r) => {
            const media = mediaByProduct.get(r.id);
            const rating = ratings.get(r.id);
            return {
              id: r.pubId,
              slug: r.slug,
              title: tr.get(r.id)?.get('title') ?? r.title,
              base_price: r.basePriceAmount ? present.money(r.basePriceAmount) : null,
              vendor: r.vendor,
              brand_name: r.brandName,
              published_at: r.publishedAt,
              primary_image: media ? { url: media.url, alt: media.alt } : null,
              rating: rating ? { average: rating.average, count: rating.count } : { average: null, count: 0 },
            };
          }),
          count: rows.length,
          currency: present.currency,
          facets: facetFilters,
          offset,
          limit,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/products/{productSlug}
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; productSlug: string }; Querystring: { currency?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products/:productSlug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      // Presentment currency (P1) — convert displayed prices via ČNB FX.
      const present = await buildPresenter(db, tenant, req.query.currency);

      const locale = resolveServeLocale(
        requestedLocale(req),
        (tenant.enabledLocales as string[]) ?? [],
        tenant.defaultLocale,
      );
      const loaded = await withTenant(rlsDb, tenant.id, async (tx) => {
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.tenantId, tenant.id),
              eq(schema.products.slug, req.params.productSlug),
              eq(schema.products.status, 'active'),
              dsql`${schema.products.publishedAt} IS NOT NULL`,
            ),
          )
          .limit(1);
        if (!product) return null;

        const [variants, media, catRows, reviewSummary, reviews] = await Promise.all([
          tx
            .select()
            .from(schema.productVariants)
            .where(eq(schema.productVariants.productId, product.id))
            .orderBy(asc(schema.productVariants.position)),
          tx
            .select()
            .from(schema.productMedia)
            .where(eq(schema.productMedia.productId, product.id))
            .orderBy(asc(schema.productMedia.position)),
          tx
            .select({
              id: schema.categories.id,
              slug: schema.categories.slug,
              name: schema.categories.name,
              path: schema.categories.path,
            })
            .from(schema.productCategories)
            .innerJoin(
              schema.categories,
              eq(schema.productCategories.categoryId, schema.categories.id),
            )
            .where(eq(schema.productCategories.productId, product.id)),
          ratingSummary(tx, product.id),
          listPublishedReviews(tx, product.id, 50),
        ]);

        // i18n (per `23`): localize product title/description + category names.
        const [prodTr, catTr] = await Promise.all([
          loadTranslations(tx, tenant.id, 'product', [product.id], locale, tenant.defaultLocale),
          loadTranslations(tx, tenant.id, 'category', catRows.map((c) => c.id), locale, tenant.defaultLocale),
        ]);
        // Bundle composition (per `06` §3.5) — components + derived availability.
        const bundleItems =
          product.type === 'bundle' ? await loadBundleComponents(tx, tenant.id, product.id) : [];
        // EU Omnibus: lowest price of the last 30 days per variant (for sales).
        const lowest30d = await lowestPriceLast30Days(
          tx,
          tenant.id,
          variants.map((v) => v.id),
          new Date(),
        );
        // Page-builder content blocks (per `32`) for the PDP — stored in
        // metadata.content_blocks, dereferencing reusable sections.
        const library = ((tenant.settings ?? {}) as { reusable_sections?: SectionLibraryItem[] })
          .reusable_sections ?? [];
        const contentBlocks = await resolveBlocks(
          tx,
          tenant.id,
          (product.metadata as { content_blocks?: unknown } | null)?.content_blocks ?? [],
          library,
        );
        return { product, variants, media, catRows, reviewSummary, reviews, prodTr, catTr, bundleItems, lowest30d, contentBlocks };
      });

      if (!loaded) return notFound(reply, 'product');
      const { product, variants, media, catRows, reviewSummary, reviews, prodTr, catTr, bundleItems, lowest30d, contentBlocks } =
        loaded;
      const po = prodTr.get(product.id);
      const bundleAvail = product.type === 'bundle' ? bundleAvailableQuantity(bundleItems) : null;

      return reply.send({
        data: {
          locale,
          id: product.pubId,
          slug: product.slug,
          type: product.type,
          title: po?.get('title') ?? product.title,
          description_html: po?.get('description_html') ?? product.descriptionHtml,
          // Page-builder content blocks (per `32`) — rendered below the description.
          content_blocks: contentBlocks,
          base_price: product.basePriceAmount ? present.money(product.basePriceAmount) : null,
          compare_at: product.compareAtAmount ? present.money(product.compareAtAmount) : null,
          currency: present.currency,
          vendor: product.vendor,
          brand_name: product.brandName,
          published_at: product.publishedAt,
          attributes: product.attributes,
          // Statutory disclosures (CZ): recycling fee (PHE, included in price) +
          // returnable deposit (added on top, no VAT).
          recycling_fee: product.recyclingFeeAmount ? present.money(product.recyclingFeeAmount) : null,
          deposit: product.depositAmount ? present.money(product.depositAmount) : null,
          // Unit pricing (EU 98/6/ES) — "cena za měrnou jednotku".
          unit_pricing: unitPricing(
            present,
            product.basePriceAmount ?? variants[0]?.priceAmount ?? null,
            product.unitContentAmount,
            product.unitContentUom,
            product.unitBaseAmount,
          ),
          variants: variants.map((v) => ({
            id: v.pubId,
            sku: v.sku,
            title: v.title,
            price: present.money(v.priceAmount),
            compare_at: v.compareAtAmount ? present.money(v.compareAtAmount) : null,
            min_order_quantity: v.minOrderQuantity,
            max_order_quantity: v.maxOrderQuantity,
            unit_pricing: unitPricing(
              present,
              v.priceAmount,
              product.unitContentAmount,
              product.unitContentUom,
              product.unitBaseAmount,
            ),
            // EU Omnibus (per directive 2019/2161): lowest price of the last 30
            // days — shown next to the sale price. Only meaningful when on sale.
            lowest_price_30d:
              v.compareAtAmount && lowest30d.get(v.id) != null
                ? present.money(lowest30d.get(v.id)!)
                : null,
            // Customer-facing availability = on hand − reserved (per `09`)
            stock_on_hand: Math.max(0, v.stockOnHand - v.stockReserved),
            in_stock: v.stockOnHand - v.stockReserved > 0 || v.allowBackorder,
            option_values: v.optionValues,
            position: v.position,
          })),
          media: media.map((m) => ({
            id: m.pubId,
            kind: m.kind,
            url: m.url,
            alt: m.alt,
            width_px: m.widthPx,
            height_px: m.heightPx,
            position: m.position,
            is_primary: m.isPrimary,
          })),
          categories: catRows.map((c) => ({
            slug: c.slug,
            name: catTr.get(c.id)?.get('name') ?? c.name,
            path: c.path,
          })),
          // Bundle contents (per `06` §3.5) — present only for bundle products.
          bundle: product.type === 'bundle'
            ? {
                available_quantity: Number.isFinite(bundleAvail) ? bundleAvail : null,
                in_stock: (bundleAvail ?? 0) > 0,
                items: bundleItems.map((b) => ({
                  product_slug: b.productSlug,
                  title: b.title,
                  variant_title: b.variantTitle,
                  sku: b.sku,
                  quantity: b.quantity,
                  is_optional: b.isOptional,
                })),
              }
            : null,
          rating: { average: reviewSummary.average, count: reviewSummary.count },
          reviews: reviews.map((r) => ({
            id: r.pubId,
            author: r.authorName,
            rating: r.rating,
            title: r.title,
            body: r.body,
            verified_purchase: r.verifiedPurchase,
            created_at: r.createdAt,
          })),
          tenant: {
            slug: tenant.slug,
            display_name: tenant.displayName,
            default_currency: tenant.defaultCurrency,
          },
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/products/{productSlug}/recommendations (P2) —
  // "frequently bought together" (from order data) + related (same category).
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; productSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products/:productSlug/recommendations',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const data = await withTenant(rlsDb, tenant.id, async (tx) => {
        const [product] = await tx
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(
            and(
              eq(schema.products.tenantId, tenant.id),
              eq(schema.products.slug, req.params.productSlug),
              eq(schema.products.status, 'active'),
            ),
          )
          .limit(1);
        if (!product) return null;
        const [fbt, related] = await Promise.all([
          frequentlyBoughtTogether(tx, tenant.id, product.id, 4),
          relatedProducts(tx, tenant.id, product.id, 4),
        ]);
        return { fbt, related };
      });
      if (!data) return notFound(reply, 'product');
      return reply
        .header('cache-control', 'public, max-age=600')
        .send({ data: { frequently_bought_together: data.fbt, related: data.related } });
    },
  );

  // GET /storefront/{tenantSlug}/bestsellers?limit=&category= (Shoptet "Top
  // nejprodávanější") — most-sold products, optionally within a category.
  app.get<{ Params: { tenantSlug: string }; Querystring: { limit?: string; category?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/bestsellers',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);
      const products = await withTenant(rlsDb, tenant.id, async (tx) => {
        let categoryId: string | undefined;
        if (req.query.category) {
          const [cat] = await tx
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(and(eq(schema.categories.tenantId, tenant.id), eq(schema.categories.slug, req.query.category!)))
            .limit(1);
          categoryId = cat?.id;
        }
        return bestSellers(tx, tenant.id, limit, categoryId);
      });
      return reply.header('cache-control', 'public, max-age=600').send({ data: { products } });
    },
  );

  // POST /storefront/{tenantSlug}/products/{productSlug}/watch (Shoptet "Hlídací
  // pes") — leave an e-mail to be notified when a variant is back in stock.
  app.post<{ Params: { tenantSlug: string; productSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products/:productSlug/watch',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const parsed = z
        .object({ email: z.string().email().toLowerCase(), variantId: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Neplatný e-mail nebo varianta' } });
      }
      const result = await withTenant(rlsDb, tenant.id, async (tx) => {
        const [v] = await tx
          .select({ id: schema.productVariants.id })
          .from(schema.productVariants)
          .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
          .where(
            and(
              eq(schema.productVariants.tenantId, tenant.id),
              eq(schema.products.slug, req.params.productSlug),
              parsed.data.variantId.startsWith('prv_')
                ? eq(schema.productVariants.pubId, parsed.data.variantId)
                : eq(schema.productVariants.id, parsed.data.variantId),
            ),
          )
          .limit(1);
        if (!v) return null;
        await addStockWatch(tx, tenant.id, v.id, parsed.data.email);
        return v.id;
      });
      if (!result) return notFound(reply, 'variant');
      return reply.code(201).send({ data: { watching: true } });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/newsletter/subscribe (P3) — public opt-in.
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string }; Body: { email?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/newsletter/subscribe',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const email = (req.body?.email ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return reply.code(422).send({ error: { code: 'INVALID_EMAIL', message: 'Neplatný e-mail' } });
      }
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      await withTenant(rlsDb, tenant.id, (tx) => subscribeNewsletter(tx, tenant.id, email, 'storefront'));
      return reply.code(201).send({ data: { subscribed: true } });
    },
  );

  // GET /storefront/{tenantSlug}/newsletter/unsubscribe?token= — one-click opt-out.
  app.get<{ Params: { tenantSlug: string }; Querystring: { token?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/newsletter/unsubscribe',
    async (req, reply) => {
      const token = (req.query.token ?? '').trim();
      const email = token ? await unsubscribeByToken(db, token) : null;
      return reply
        .header('content-type', 'text/html; charset=utf-8')
        .send(
          `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem">` +
            (email
              ? `<h1>Odhlášeno</h1><p>${email} už nebude dostávat náš newsletter.</p>`
              : `<h1>Neplatný odkaz</h1><p>Odkaz pro odhlášení je neplatný nebo vypršel.</p>`) +
            `</body>`,
        );
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/collections — active dynamic collections (P3).
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/collections',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const rows = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select({
            pubId: schema.collections.pubId,
            name: schema.collections.name,
            slug: schema.collections.slug,
            description: schema.collections.description,
          })
          .from(schema.collections)
          .where(and(eq(schema.collections.tenantId, tenant.id), eq(schema.collections.isActive, true)))
          .orderBy(desc(schema.collections.position)),
      );
      return reply
        .header('cache-control', 'public, max-age=600')
        .send({ data: { collections: rows.map((r) => ({ id: r.pubId, name: r.name, slug: r.slug, description: r.description })) } });
    },
  );

  // GET /storefront/{tenantSlug}/collections/{slug} — resolved products (P3),
  // in the requested presentment currency.
  app.get<{ Params: { tenantSlug: string; collectionSlug: string }; Querystring: { currency?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/collections/:collectionSlug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const present = await buildPresenter(db, tenant, req.query.currency);
      const loaded = await withTenant(rlsDb, tenant.id, async (tx) => {
        const [col] = await tx
          .select()
          .from(schema.collections)
          .where(
            and(
              eq(schema.collections.tenantId, tenant.id),
              eq(schema.collections.slug, req.params.collectionSlug),
              eq(schema.collections.isActive, true),
            ),
          )
          .limit(1);
        if (!col) return null;
        const products = await resolveCollection(tx, tenant.id, col.rules as CollectionRules, 48);
        return { col, products };
      });
      if (!loaded) return notFound(reply, 'collection');
      return reply.send({
        data: {
          name: loaded.col.name,
          slug: loaded.col.slug,
          description: loaded.col.description,
          seo_title: loaded.col.seoTitle,
          seo_description: loaded.col.seoDescription,
          currency: present.currency,
          products: loaded.products.map((p) => ({
            ...p,
            base_price: p.base_price ? present.money(BigInt(p.base_price.amount)) : null,
          })),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // CMS content (per `32`) — published-only, public.
  // ---------------------------------------------------------------------------

  // GET /storefront/{tenantSlug}/homepage — page-builder blocks for the home
  // page (per `32`), resolved to render-ready data. Stored in
  // tenant.settings.homepage.blocks. Empty array = use the theme default hero.
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/homepage',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const settings = (tenant.settings ?? {}) as {
        homepage?: { blocks?: unknown };
        reusable_sections?: SectionLibraryItem[];
      };
      const blocks = await withTenant(rlsDb, tenant.id, (tx) =>
        resolveBlocks(tx, tenant.id, settings.homepage?.blocks ?? [], settings.reusable_sections ?? []),
      );
      return reply
        .header('cache-control', 'public, max-age=120')
        .send({ data: { blocks } });
    },
  );

  // GET /storefront/{tenantSlug}/pages — published page list (footer nav)
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/pages',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const rows = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select({ slug: schema.cmsPages.slug, title: schema.cmsPages.title })
          .from(schema.cmsPages)
          .where(and(eq(schema.cmsPages.tenantId, tenant.id), eq(schema.cmsPages.status, 'published')))
          .orderBy(asc(schema.cmsPages.title)),
      );
      return reply.send({ data: { pages: rows } });
    },
  );

  // GET /storefront/{tenantSlug}/pages/{slug} — published page detail
  app.get<{ Params: { tenantSlug: string; slug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/pages/:slug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const [page] = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select()
          .from(schema.cmsPages)
          .where(
            and(
              eq(schema.cmsPages.tenantId, tenant.id),
              eq(schema.cmsPages.slug, req.params.slug),
              eq(schema.cmsPages.status, 'published'),
            ),
          )
          .limit(1),
      );
      if (!page) return notFound(reply, 'page');
      // Page-builder blocks (per `32`) — resolved to render-ready data when set,
      // dereferencing reusable sections from the tenant's library.
      const library = ((tenant.settings ?? {}) as { reusable_sections?: SectionLibraryItem[] })
        .reusable_sections ?? [];
      const blocks = await withTenant(rlsDb, tenant.id, (tx) =>
        resolveBlocks(tx, tenant.id, page.blocks, library),
      );
      return reply.send({
        data: {
          slug: page.slug,
          title: page.title,
          body_html: page.bodyHtml,
          blocks,
          seo_title: page.seoTitle,
          seo_description: page.seoDescription,
          updated_at: page.updatedAt,
        },
      });
    },
  );

  // GET /storefront/{tenantSlug}/blog — published posts
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/blog',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const rows = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select({
            slug: schema.cmsBlogPosts.slug,
            title: schema.cmsBlogPosts.title,
            excerpt: schema.cmsBlogPosts.excerpt,
            coverImageUrl: schema.cmsBlogPosts.coverImageUrl,
            publishedAt: schema.cmsBlogPosts.publishedAt,
          })
          .from(schema.cmsBlogPosts)
          .where(
            and(
              eq(schema.cmsBlogPosts.tenantId, tenant.id),
              eq(schema.cmsBlogPosts.status, 'published'),
            ),
          )
          .orderBy(desc(schema.cmsBlogPosts.publishedAt))
          .limit(100),
      );
      return reply.send({
        data: {
          posts: rows.map((p) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            cover_image_url: p.coverImageUrl,
            published_at: p.publishedAt,
          })),
        },
      });
    },
  );

  // GET /storefront/{tenantSlug}/blog/{slug} — published post detail
  app.get<{ Params: { tenantSlug: string; slug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/blog/:slug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const [post] = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select()
          .from(schema.cmsBlogPosts)
          .where(
            and(
              eq(schema.cmsBlogPosts.tenantId, tenant.id),
              eq(schema.cmsBlogPosts.slug, req.params.slug),
              eq(schema.cmsBlogPosts.status, 'published'),
            ),
          )
          .limit(1),
      );
      if (!post) return notFound(reply, 'post');
      return reply.send({
        data: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          cover_image_url: post.coverImageUrl,
          body_html: post.bodyHtml,
          seo_title: post.seoTitle,
          seo_description: post.seoDescription,
          published_at: post.publishedAt,
        },
      });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

/** Money object presented (converted) in the resolved presentment currency. */
interface Presenter {
  currency: string;
  /** Convert a base-currency minor amount to the presentment currency. */
  money: (minor: bigint) => { amount: string; currency: string };
}

/** Sensible "price per …" base when the merchant didn't set one explicitly. */
function defaultUnitBase(uom: string): number {
  return uom === 'g' || uom === 'ml' ? 100 : 1; // Kč/100 g, Kč/100 ml; else Kč/1 unit
}

/** EU 98/6/ES unit price ("cena za měrnou jednotku"): price scaled to the base
 * measure. Null unless the product declares content amount + unit. */
function unitPricing(
  present: Presenter,
  price: bigint | null,
  contentAmount: string | null,
  uom: string | null,
  baseAmount: string | null,
) {
  if (price == null || !contentAmount || !uom) return null;
  const content = Number(contentAmount);
  if (!Number.isFinite(content) || content <= 0) return null;
  const base = baseAmount ? Number(baseAmount) : defaultUnitBase(uom);
  if (!Number.isFinite(base) || base <= 0) return null;
  const perBase = BigInt(Math.round(Number(price) * (base / content)));
  return {
    price_per_base: present.money(perBase),
    base_amount: base,
    uom,
    content_amount: content,
  };
}

/**
 * Build a price presenter for a request's `?currency=`. Falls back to the base
 * (tenant.defaultCurrency) when the currency is unsupported or a rate is missing.
 */
async function buildPresenter(
  db: AppDb,
  tenant: { defaultCurrency: string; settings: unknown },
  requested: string | undefined,
): Promise<Presenter> {
  const cfg = readCurrencyConfig(tenant.defaultCurrency, tenant.settings);
  const target = resolvePresentmentCurrency(requested, cfg);
  if (target === cfg.base) {
    return { currency: cfg.base, money: (minor) => ({ amount: minor.toString(), currency: cfg.base }) };
  }
  const rates = await loadRates(db);
  const conv = makeConverter(cfg.base, target, rates);
  return {
    currency: target,
    money: (minor) => conv(minor) ?? { amount: minor.toString(), currency: cfg.base },
  };
}

async function resolveTenant(db: AppDb, slug: string) {
  const [tenant] = await db
    .select({
      id: schema.tenants.id,
      pubId: schema.tenants.pubId,
      slug: schema.tenants.slug,
      displayName: schema.tenants.displayName,
      defaultLocale: schema.tenants.defaultLocale,
      enabledLocales: schema.tenants.enabledLocales,
      defaultCurrency: schema.tenants.defaultCurrency,
      countryCode: schema.tenants.countryCode,
      priceIncludesTax: schema.tenants.priceIncludesTax,
      status: schema.tenants.status,
      settings: schema.tenants.settings,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);

  if (!tenant || tenant.status !== 'active') return null;
  return tenant;
}

function notFound(reply: any, kind: string) {
  return reply.code(404).send({
    error: { code: `${kind.toUpperCase()}_NOT_FOUND`, message: `${kind} not found` },
  });
}

/** Requested storefront locale from `?locale=` (per `23`). */
function requestedLocale(req: { query: unknown }): string | undefined {
  const q = (req.query as { locale?: string }).locale;
  return typeof q === 'string' && q ? q : undefined;
}
