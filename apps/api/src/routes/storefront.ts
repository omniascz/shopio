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
import { schema } from '@shopio/db';
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
  const { db } = opts;

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug} — tenant info
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const appearance = ((tenant.settings ?? {}) as {
        appearance?: { theme?: string; accent_color?: string; logo_url?: string };
      }).appearance;

      return reply.send({
        data: {
          tenant: {
            id: tenant.pubId,
            slug: tenant.slug,
            display_name: tenant.displayName,
            default_locale: tenant.defaultLocale,
            default_currency: tenant.defaultCurrency,
            country_code: tenant.countryCode,
            appearance: {
              theme: appearance?.theme ?? 'minimal',
              accent_color: appearance?.accent_color ?? '#111111',
              logo_url: appearance?.logo_url ?? null,
            },
          },
        },
      });
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

      const rows = await db
        .select({
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

      return reply.send({
        data: {
          categories: rows.map((r) => ({
            id: r.pubId,
            slug: r.slug,
            name: r.name,
            description: r.description,
            path: r.path,
            depth: r.depth,
            parent_id: r.parentId,
          })),
          count: rows.length,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/products
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_FAILED', message: 'Invalid query params' },
        });
      }
      const { q, categorySlug, limit, offset, sort } = parsed.data;

      // Filter: only active + published products
      const conditions = [
        eq(schema.products.tenantId, tenant.id),
        eq(schema.products.status, 'active'),
        dsql`${schema.products.publishedAt} IS NOT NULL`,
      ];
      if (q) {
        conditions.push(
          dsql`(${schema.products.title} ILIKE ${'%' + q + '%'} OR ${schema.products.slug} ILIKE ${'%' + q + '%'})`,
        );
      }

      let categoryId: string | undefined;
      if (categorySlug) {
        const [cat] = await db
          .select({ id: schema.categories.id })
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.tenantId, tenant.id),
              eq(schema.categories.slug, categorySlug),
            ),
          )
          .limit(1);
        if (!cat) return notFound(reply, 'category');
        categoryId = cat.id;
      }

      const baseQuery = categoryId
        ? db
            .select({
              id: schema.products.id,
              pubId: schema.products.pubId,
              slug: schema.products.slug,
              title: schema.products.title,
              basePriceAmount: schema.products.basePriceAmount,
              basePriceCurrency: schema.products.basePriceCurrency,
              vendor: schema.products.vendor,
              brandName: schema.products.brandName,
              publishedAt: schema.products.publishedAt,
            })
            .from(schema.products)
            .innerJoin(
              schema.productCategories,
              eq(schema.productCategories.productId, schema.products.id),
            )
            .where(and(...conditions, eq(schema.productCategories.categoryId, categoryId)))
        : db
            .select({
              id: schema.products.id,
              pubId: schema.products.pubId,
              slug: schema.products.slug,
              title: schema.products.title,
              basePriceAmount: schema.products.basePriceAmount,
              basePriceCurrency: schema.products.basePriceCurrency,
              vendor: schema.products.vendor,
              brandName: schema.products.brandName,
              publishedAt: schema.products.publishedAt,
            })
            .from(schema.products)
            .where(and(...conditions));

      const order =
        sort === 'recent'
          ? desc(schema.products.publishedAt)
          : sort === 'oldest'
            ? asc(schema.products.publishedAt)
            : asc(schema.products.title);

      const rows = await baseQuery.orderBy(order).limit(limit).offset(offset);

      // Fetch primary media for each product (one batch query)
      const productIds = rows.map((r) => r.id);
      const primaryMedia = productIds.length
        ? await db
            .select({
              productId: schema.productMedia.productId,
              url: schema.productMedia.url,
              alt: schema.productMedia.alt,
            })
            .from(schema.productMedia)
            .where(
              and(
                inArray(schema.productMedia.productId, productIds),
                eq(schema.productMedia.position, 0),
              ),
            )
        : [];
      const mediaByProduct = new Map(primaryMedia.map((m) => [m.productId, m]));

      return reply.send({
        data: {
          products: rows.map((r) => {
            const media = mediaByProduct.get(r.id);
            return {
              id: r.pubId,
              slug: r.slug,
              title: r.title,
              base_price: r.basePriceAmount
                ? { amount: r.basePriceAmount.toString(), currency: r.basePriceCurrency }
                : null,
              vendor: r.vendor,
              brand_name: r.brandName,
              published_at: r.publishedAt,
              primary_image: media ? { url: media.url, alt: media.alt } : null,
            };
          }),
          count: rows.length,
          offset,
          limit,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/products/{productSlug}
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; productSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/products/:productSlug',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const [product] = await db
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

      if (!product) return notFound(reply, 'product');

      const [variants, media, catRows] = await Promise.all([
        db
          .select()
          .from(schema.productVariants)
          .where(eq(schema.productVariants.productId, product.id))
          .orderBy(asc(schema.productVariants.position)),
        db
          .select()
          .from(schema.productMedia)
          .where(eq(schema.productMedia.productId, product.id))
          .orderBy(asc(schema.productMedia.position)),
        db
          .select({
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
      ]);

      return reply.send({
        data: {
          id: product.pubId,
          slug: product.slug,
          title: product.title,
          description_html: product.descriptionHtml,
          base_price: product.basePriceAmount
            ? {
                amount: product.basePriceAmount.toString(),
                currency: product.basePriceCurrency,
              }
            : null,
          compare_at: product.compareAtAmount
            ? { amount: product.compareAtAmount.toString(), currency: product.basePriceCurrency }
            : null,
          vendor: product.vendor,
          brand_name: product.brandName,
          published_at: product.publishedAt,
          variants: variants.map((v) => ({
            id: v.pubId,
            sku: v.sku,
            title: v.title,
            price: { amount: v.priceAmount.toString(), currency: v.priceCurrency },
            compare_at: v.compareAtAmount
              ? { amount: v.compareAtAmount.toString(), currency: v.priceCurrency }
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
            name: c.name,
            path: c.path,
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
}

// =============================================================================
// Helpers
// =============================================================================

async function resolveTenant(db: AppDb, slug: string) {
  const [tenant] = await db
    .select({
      id: schema.tenants.id,
      pubId: schema.tenants.pubId,
      slug: schema.tenants.slug,
      displayName: schema.tenants.displayName,
      defaultLocale: schema.tenants.defaultLocale,
      defaultCurrency: schema.tenants.defaultCurrency,
      countryCode: schema.tenants.countryCode,
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
