/**
 * Products + categories CRUD endpoints.
 *
 * Per `06-catalog-pim.md` + `07-categories-taxonomy.md`.
 * Tenant-scoped via req.auth.tenantId — every query filters by tenant.
 *
 * Endpoints:
 *   Categories:
 *     POST  /api/{date}/categories                      create
 *     GET   /api/{date}/categories                      list (tenant-scoped)
 *
 *   Products:
 *     POST  /api/{date}/products                        create + variants + media + categories
 *     GET   /api/{date}/products                        list with filters
 *     GET   /api/{date}/products/{idOrSlug}             detail with variants + media
 *     PATCH /api/{date}/products/{id}                   update
 *     DELETE /api/{date}/products/{id}                  archive
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, or, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, can, generatePubId, type PermissionCode } from '@shopio/authz';
import { requireAuth } from '../plugins/auth-middleware';
import { indexProduct, removeProductFromIndex } from '../lib/search';
import { mapImportRows, parseCsv } from '../lib/csv';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

// =============================================================================
// Schemas
// =============================================================================

const CreateCategoryBody = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(2000).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  iconName: z.string().max(64).optional(),
});

const VariantInput = z.object({
  sku: z.string().max(64).optional(),
  barcode: z.string().max(32).optional(),
  title: z.string().max(255).default('Default'),
  priceAmount: z.union([z.bigint(), z.number(), z.string()]).transform((v) => BigInt(v)),
  priceCurrency: z.string().length(3).default('CZK'),
  compareAtAmount: z
    .union([z.bigint(), z.number(), z.string()])
    .transform((v) => (v ? BigInt(v) : null))
    .optional(),
  weightGrams: z.number().int().nonnegative().optional(),
  requiresShipping: z.boolean().default(true),
  stockOnHand: z.number().int().nonnegative().default(0),
  allowBackorder: z.boolean().default(false),
  optionValues: z.record(z.string(), z.string()).default({}),
  position: z.number().int().default(0),
});

const MediaInput = z.object({
  kind: z.enum(['image', 'video', 'model_3d']).default('image'),
  url: z.string().url().or(z.string().startsWith('/')),
  alt: z.string().max(255).optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  position: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

const CreateProductBody = z.object({
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  descriptionHtml: z.string().max(50000).optional(),
  basePriceAmount: z
    .union([z.bigint(), z.number(), z.string()])
    .transform((v) => (v ? BigInt(v) : null))
    .optional(),
  basePriceCurrency: z.string().length(3).optional(),
  status: z.enum(['draft', 'active', 'archived', 'unpublished']).default('draft'),
  vendor: z.string().max(120).optional(),
  brandName: z.string().max(120).optional(),
  attributes: z
    .array(z.object({ name: z.string().min(1).max(80), value: z.string().min(1).max(200) }))
    .max(50)
    .default([]),
  variants: z.array(VariantInput).min(1).max(100),
  media: z.array(MediaInput).max(50).default([]),
  categoryIds: z.array(z.string().uuid()).max(20).default([]),
});

const UpdateProductBody = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  descriptionHtml: z.string().max(50000).optional(),
  basePriceAmount: z
    .union([z.bigint(), z.number(), z.string()])
    .transform((v) => (v ? BigInt(v) : null))
    .optional(),
  basePriceCurrency: z.string().length(3).optional(),
  status: z.enum(['draft', 'active', 'archived', 'unpublished']).optional(),
  vendor: z.string().max(120).nullable().optional(),
  brandName: z.string().max(120).nullable().optional(),
  /** Spec parameters (replace whole list). */
  attributes: z
    .array(z.object({ name: z.string().min(1).max(80), value: z.string().min(1).max(200) }))
    .max(50)
    .optional(),
  /** Full replacement of category assignments (M:M sync). Accepts category
   * pub_ids (cat_…) or internal UUIDs. */
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
});

const UpdateVariantBody = z.object({
  title: z.string().min(1).max(255).optional(),
  sku: z.string().max(64).nullable().optional(),
  priceAmount: z
    .union([z.bigint(), z.number(), z.string()])
    .transform((v) => BigInt(v))
    .optional(),
  compareAtAmount: z
    .union([z.bigint(), z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === '' ? null : BigInt(v)))
    .optional(),
  weightGrams: z.number().int().nonnegative().nullable().optional(),
  allowBackorder: z.boolean().optional(),
  /** Absolute stock level — recorded as an `adjustment` ledger movement. */
  stockOnHand: z.number().int().nonnegative().optional(),
  stockNote: z.string().max(500).optional(),
});

const ListProductsQuery = z.object({
  status: z.enum(['draft', 'active', 'archived', 'unpublished']).optional(),
  q: z.string().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'oldest', 'title']).default('recent'),
});

// =============================================================================
// Plugin
// =============================================================================

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerProductRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);

  // ---------------------------------------------------------------------------
  // POST /categories
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/categories', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    if (!ensureTenant(auth, reply)) return;
    if (!ensurePermission(auth, PERMISSIONS.PRODUCT_EDIT, reply)) return;

    const parsed = CreateCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send(zodErr(parsed.error));
    }
    const input = parsed.data;
    const slug = input.slug ?? slugify(input.name);

    // Compute path + depth (per `07 §RULE-CAT-002`)
    let path = slug;
    let depth = 0;
    let parentId: string | null = null;
    if (input.parentId) {
      const [parent] = await db
        .select({
          id: schema.categories.id,
          path: schema.categories.path,
          depth: schema.categories.depth,
        })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.tenantId, auth.tenantId),
            eq(schema.categories.id, input.parentId),
          ),
        )
        .limit(1);
      if (!parent) {
        return reply.code(422).send({
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent category not found' },
        });
      }
      path = `${parent.path}.${slug}`;
      depth = parent.depth + 1;
      parentId = parent.id;
    }

    try {
      const [cat] = await db
        .insert(schema.categories)
        .values({
          tenantId: auth.tenantId,
          pubId: generatePubId('cat'),
          slug,
          name: input.name,
          description: input.description ?? null,
          path,
          parentId,
          depth,
          sortOrder: input.sortOrder,
          iconName: input.iconName ?? null,
          status: 'active',
        })
        .returning();

      return reply.code(201).send({
        data: {
          id: cat!.pubId,
          slug: cat!.slug,
          name: cat!.name,
          description: cat!.description,
          path: cat!.path,
          parent_id: cat!.parentId,
          depth: cat!.depth,
          status: cat!.status,
          created_at: cat!.createdAt,
        },
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({
          error: { code: 'CATEGORY_EXISTS', message: 'Category with that slug already exists' },
        });
      }
      throw err;
    }
  });

  // ---------------------------------------------------------------------------
  // GET /categories
  // ---------------------------------------------------------------------------
  app.get('/api/2026-05-20/categories', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    if (!ensureTenant(auth, reply)) return;

    const rows = await withTenant(rlsDb, auth.tenantId!, (tx) =>
      tx
        .select({
          id: schema.categories.id,
          pubId: schema.categories.pubId,
          slug: schema.categories.slug,
          name: schema.categories.name,
          path: schema.categories.path,
          parentId: schema.categories.parentId,
          depth: schema.categories.depth,
          sortOrder: schema.categories.sortOrder,
          status: schema.categories.status,
        })
        .from(schema.categories)
        .where(eq(schema.categories.tenantId, auth.tenantId!))
        .orderBy(asc(schema.categories.path), asc(schema.categories.sortOrder)),
    );

    return reply.send({
      data: {
        categories: rows.map((r) => ({
          id: r.pubId,
          slug: r.slug,
          name: r.name,
          path: r.path,
          parent_id: r.parentId,
          depth: r.depth,
          sort_order: r.sortOrder,
          status: r.status,
        })),
        count: rows.length,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /products — create with variants + media + categories
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/products', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    if (!ensureTenant(auth, reply)) return;
    if (!ensurePermission(auth, PERMISSIONS.PRODUCT_CREATE, reply)) return;

    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send(zodErr(parsed.error));
    }
    const input = parsed.data;
    const slug = input.slug ?? slugify(input.title);

    // Validate categories belong to tenant
    if (input.categoryIds.length > 0) {
      const valid = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.tenantId, auth.tenantId),
            inArray(schema.categories.id, input.categoryIds),
          ),
        );
      if (valid.length !== input.categoryIds.length) {
        return reply.code(422).send({
          error: { code: 'INVALID_CATEGORIES', message: 'One or more categories not in tenant' },
        });
      }
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [product] = await tx
          .insert(schema.products)
          .values({
            tenantId: auth.tenantId,
            pubId: generatePubId('prd'),
            slug,
            title: input.title,
            descriptionHtml: input.descriptionHtml ?? null,
            basePriceAmount: input.basePriceAmount ?? null,
            basePriceCurrency: input.basePriceCurrency ?? null,
            status: input.status,
            vendor: input.vendor ?? null,
            brandName: input.brandName ?? null,
            attributes: input.attributes,
            publishedAt: input.status === 'active' ? new Date() : null,
            createdByUserId: auth.userId,
          })
          .returning();
        if (!product) throw new Error('Product insert returned empty');

        // Variants
        const variantRows = await tx
          .insert(schema.productVariants)
          .values(
            input.variants.map((v, i) => ({
              tenantId: auth.tenantId,
              productId: product.id,
              pubId: generatePubId('prv'),
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              title: v.title,
              priceAmount: v.priceAmount,
              priceCurrency: v.priceCurrency,
              compareAtAmount: v.compareAtAmount ?? null,
              weightGrams: v.weightGrams ?? null,
              requiresShipping: v.requiresShipping,
              stockOnHand: v.stockOnHand,
              allowBackorder: v.allowBackorder,
              optionValues: v.optionValues,
              position: v.position ?? i,
            })),
          )
          .returning();

        // Media
        const mediaRows =
          input.media.length > 0
            ? await tx
                .insert(schema.productMedia)
                .values(
                  input.media.map((m, i) => ({
                    tenantId: auth.tenantId,
                    productId: product.id,
                    pubId: generatePubId('mda'),
                    kind: m.kind,
                    url: m.url,
                    alt: m.alt ?? null,
                    widthPx: m.widthPx ?? null,
                    heightPx: m.heightPx ?? null,
                    position: m.position ?? i,
                    isPrimary: m.isPrimary,
                  })),
                )
                .returning()
            : [];

        // Categories M:M
        if (input.categoryIds.length > 0) {
          await tx.insert(schema.productCategories).values(
            input.categoryIds.map((catId, i) => ({
              tenantId: auth.tenantId,
              productId: product.id,
              categoryId: catId,
              position: i,
            })),
          );
        }

        return { product, variants: variantRows, media: mediaRows };
      });

      app.log.info(
        { productId: result.product.id, tenantId: auth.tenantId },
        'products.create.success',
      );
      void indexProduct(config, db, result.product.id, app.log);

      return reply.code(201).send({
        data: serializeProduct(result.product, result.variants, result.media, input.categoryIds),
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({
          error: { code: 'SLUG_TAKEN', message: 'Product slug already exists for this tenant' },
        });
      }
      throw err;
    }
  });

  // ---------------------------------------------------------------------------
  // GET /products — list
  // ---------------------------------------------------------------------------
  app.get('/api/2026-05-20/products', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    if (!ensureTenant(auth, reply)) return;
    if (!ensurePermission(auth, PERMISSIONS.PRODUCT_VIEW, reply)) return;

    const parsed = ListProductsQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(422).send(zodErr(parsed.error));
    }
    const { status, q, categoryId, limit, offset, sort } = parsed.data;

    const conditions = [eq(schema.products.tenantId, auth.tenantId)];
    if (status) conditions.push(eq(schema.products.status, status));
    if (q) {
      conditions.push(
        or(
          dsql`${schema.products.title} ILIKE ${'%' + q + '%'}`,
          dsql`${schema.products.slug} ILIKE ${'%' + q + '%'}`,
        )!,
      );
    }

    const orderClause =
      sort === 'recent'
        ? desc(schema.products.createdAt)
        : sort === 'oldest'
          ? asc(schema.products.createdAt)
          : asc(schema.products.title);

    const cols = {
      id: schema.products.id,
      pubId: schema.products.pubId,
      slug: schema.products.slug,
      title: schema.products.title,
      descriptionHtml: schema.products.descriptionHtml,
      basePriceAmount: schema.products.basePriceAmount,
      basePriceCurrency: schema.products.basePriceCurrency,
      status: schema.products.status,
      vendor: schema.products.vendor,
      brandName: schema.products.brandName,
      publishedAt: schema.products.publishedAt,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
    };
    const rows = await withTenant(rlsDb, auth.tenantId!, (tx) => {
      // Optional category filter (JOIN if specified)
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
      return baseQuery.orderBy(orderClause).limit(limit).offset(offset);
    });

    return reply.send({
      data: {
        products: rows.map((r) => ({
          id: r.pubId,
          slug: r.slug,
          title: r.title,
          status: r.status,
          base_price_amount: r.basePriceAmount?.toString() ?? null,
          base_price_currency: r.basePriceCurrency,
          vendor: r.vendor,
          brand_name: r.brandName,
          published_at: r.publishedAt,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })),
        count: rows.length,
        offset,
        limit,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /products/{idOrSlug}
  // ---------------------------------------------------------------------------
  app.get<{ Params: { idOrSlug: string } }>(
    '/api/2026-05-20/products/:idOrSlug',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      if (!ensureTenant(auth, reply)) return;
      if (!ensurePermission(auth, PERMISSIONS.PRODUCT_VIEW, reply)) return;

      const { idOrSlug } = req.params;
      const isPubId = idOrSlug.startsWith('prd_');

      const found = await withTenant(rlsDb, auth.tenantId!, async (tx) => {
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.tenantId, auth.tenantId!),
              isPubId ? eq(schema.products.pubId, idOrSlug) : eq(schema.products.slug, idOrSlug),
            ),
          )
          .limit(1);
        if (!product) return null;
        const [variants, media, catRows] = await Promise.all([
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
            .select({ pubId: schema.categories.pubId })
            .from(schema.productCategories)
            .innerJoin(
              schema.categories,
              eq(schema.categories.id, schema.productCategories.categoryId),
            )
            .where(eq(schema.productCategories.productId, product.id)),
        ]);
        return { product, variants, media, catRows };
      });

      if (!found) {
        return reply.code(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product does not exist' },
        });
      }

      return reply.send({
        data: serializeProduct(
          found.product,
          found.variants,
          found.media,
          found.catRows.map((r) => r.pubId),
        ),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /products/{id}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    '/api/2026-05-20/products/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      if (!ensureTenant(auth, reply)) return;
      if (!ensurePermission(auth, PERMISSIONS.PRODUCT_EDIT, reply)) return;

      const parsed = UpdateProductBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send(zodErr(parsed.error));
      }

      const { id } = req.params;
      const isPubId = id.startsWith('prd_');

      const [existing] = await db
        .select({ id: schema.products.id, status: schema.products.status })
        .from(schema.products)
        .where(
          and(
            eq(schema.products.tenantId, auth.tenantId),
            isPubId ? eq(schema.products.pubId, id) : eq(schema.products.id, id),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.code(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
        });
      }

      const { categoryIds, ...fieldInput } = parsed.data;
      const updates: Record<string, unknown> = { ...fieldInput, updatedAt: new Date() };

      // Auto-set publishedAt on first publish
      if (parsed.data.status === 'active' && existing.status !== 'active') {
        updates.publishedAt = new Date();
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(schema.products)
          .set(updates)
          .where(eq(schema.products.id, existing.id))
          .returning();

        // Category sync — full replacement (tenant-scoped category check)
        if (categoryIds) {
          const uuidLike = categoryIds.filter((c) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c),
          );
          const valid = categoryIds.length
            ? await tx
                .select({ id: schema.categories.id })
                .from(schema.categories)
                .where(
                  and(
                    eq(schema.categories.tenantId, auth.tenantId),
                    or(
                      inArray(schema.categories.pubId, categoryIds),
                      ...(uuidLike.length ? [inArray(schema.categories.id, uuidLike)] : []),
                    ),
                  ),
                )
            : [];
          await tx
            .delete(schema.productCategories)
            .where(eq(schema.productCategories.productId, existing.id));
          if (valid.length) {
            await tx.insert(schema.productCategories).values(
              valid.map((c, idx) => ({
                tenantId: auth.tenantId,
                productId: existing.id,
                categoryId: c.id,
                position: idx,
              })),
            );
          }
        }
        return row!;
      });

      const catRows = await db
        .select({ pubId: schema.categories.pubId })
        .from(schema.productCategories)
        .innerJoin(
          schema.categories,
          eq(schema.categories.id, schema.productCategories.categoryId),
        )
        .where(eq(schema.productCategories.productId, existing.id));

      void indexProduct(config, db, existing.id, app.log);
      return reply.send({
        data: serializeProduct(updated, [], [], catRows.map((r) => r.pubId)),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /products/{id}/variants — add a variant
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/2026-05-20/products/:id/variants',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      if (!ensureTenant(auth, reply)) return;
      if (!ensurePermission(auth, PERMISSIONS.PRODUCT_EDIT, reply)) return;

      const parsed = VariantInput.safeParse(req.body);
      if (!parsed.success) return reply.code(422).send(zodErr(parsed.error));
      const input = parsed.data;

      const { id } = req.params;
      const [product] = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(
          and(
            eq(schema.products.tenantId, auth.tenantId),
            id.startsWith('prd_') ? eq(schema.products.pubId, id) : eq(schema.products.id, id),
          ),
        )
        .limit(1);
      if (!product) {
        return reply.code(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
        });
      }

      const created = await db.transaction(async (tx) => {
        const [agg] = await tx
          .select({ maxPos: dsql<number>`COALESCE(MAX(${schema.productVariants.position}), -1)::int` })
          .from(schema.productVariants)
          .where(eq(schema.productVariants.productId, product.id));

        const [variant] = await tx
          .insert(schema.productVariants)
          .values({
            tenantId: auth.tenantId,
            productId: product.id,
            pubId: generatePubId('prv'),
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            title: input.title,
            priceAmount: input.priceAmount,
            priceCurrency: input.priceCurrency,
            compareAtAmount: input.compareAtAmount ?? null,
            weightGrams: input.weightGrams ?? null,
            requiresShipping: input.requiresShipping,
            stockOnHand: input.stockOnHand,
            allowBackorder: input.allowBackorder,
            optionValues: input.optionValues,
            position: (agg?.maxPos ?? -1) + 1,
          })
          .returning();

        // Initial stock → ledger baseline (per `09`)
        if (input.stockOnHand > 0) {
          await tx.insert(schema.stockMovements).values({
            tenantId: auth.tenantId,
            variantId: variant!.id,
            quantityDelta: input.stockOnHand,
            reason: 'initial_load',
            referenceType: 'manual',
            resultingStockOnHand: input.stockOnHand,
            actorUserId: auth.userId,
          });
        }
        return variant!;
      });

      void indexProduct(config, db, product.id, app.log);
      return reply.code(201).send({
        data: {
          id: created.pubId,
          sku: created.sku,
          title: created.title,
          price_amount: created.priceAmount.toString(),
          price_currency: created.priceCurrency,
          stock_on_hand: created.stockOnHand,
          stock_reserved: created.stockReserved,
          stock_available: created.stockOnHand - created.stockReserved,
          option_values: created.optionValues,
          position: created.position,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /products/{id}/variants/{variantId} — price/stock/detail edit
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { id: string; variantId: string } }>(
    '/api/2026-05-20/products/:id/variants/:variantId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      if (!ensureTenant(auth, reply)) return;
      if (!ensurePermission(auth, PERMISSIONS.PRODUCT_EDIT, reply)) return;

      const parsed = UpdateVariantBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send(zodErr(parsed.error));
      }
      const input = parsed.data;

      const { id, variantId } = req.params;
      const [variant] = await db
        .select({
          id: schema.productVariants.id,
          productId: schema.productVariants.productId,
        })
        .from(schema.productVariants)
        .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
        .where(
          and(
            eq(schema.productVariants.tenantId, auth.tenantId),
            variantId.startsWith('prv_')
              ? eq(schema.productVariants.pubId, variantId)
              : eq(schema.productVariants.id, variantId),
            id.startsWith('prd_')
              ? eq(schema.products.pubId, id)
              : eq(schema.products.id, id),
          ),
        )
        .limit(1);
      if (!variant) {
        return reply.code(404).send({
          error: { code: 'VARIANT_NOT_FOUND', message: 'Variant not found' },
        });
      }

      const updated = await db.transaction(async (tx) => {
        // Stock set goes through the movements ledger (per `09`:
        // reason='adjustment') — lock the row, compute the delta.
        if (input.stockOnHand !== undefined) {
          const [locked] = await tx
            .select({
              stockOnHand: schema.productVariants.stockOnHand,
            })
            .from(schema.productVariants)
            .where(eq(schema.productVariants.id, variant.id))
            .for('update');
          const delta = input.stockOnHand - locked!.stockOnHand;
          if (delta !== 0) {
            await tx.insert(schema.stockMovements).values({
              tenantId: auth.tenantId,
              variantId: variant.id,
              quantityDelta: delta,
              reason: 'adjustment',
              referenceType: 'manual',
              resultingStockOnHand: input.stockOnHand,
              actorUserId: auth.userId,
              note: input.stockNote ?? null,
            });
          }
        }

        // Strip undefined (exactOptionalPropertyTypes) + non-column keys
        const fields = Object.fromEntries(
          Object.entries(input).filter(([k, v]) => k !== 'stockNote' && v !== undefined),
        ) as Partial<typeof schema.productVariants.$inferInsert>;
        const [row] = await tx
          .update(schema.productVariants)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(schema.productVariants.id, variant.id))
          .returning();
        return row!;
      });

      void indexProduct(config, db, variant.productId, app.log);
      return reply.send({
        data: {
          id: updated.pubId,
          sku: updated.sku,
          title: updated.title,
          price_amount: updated.priceAmount.toString(),
          price_currency: updated.priceCurrency,
          compare_at_amount: updated.compareAtAmount?.toString() ?? null,
          weight_grams: updated.weightGrams,
          stock_on_hand: updated.stockOnHand,
          stock_reserved: updated.stockReserved,
          stock_available: updated.stockOnHand - updated.stockReserved,
          allow_backorder: updated.allowBackorder,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /products/import — CSV catalog import (multipart file)
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/products/import', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    if (!ensureTenant(auth, reply)) return;
    if (!ensurePermission(auth, PERMISSIONS.PRODUCT_CREATE, reply)) return;

    const file = await req.file({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
    if (!file) {
      return reply.code(422).send({
        error: { code: 'NO_FILE', message: 'Multipart CSV file required' },
      });
    }
    const text = (await file.toBuffer()).toString('utf8');

    let mapped;
    try {
      mapped = mapImportRows(parseCsv(text));
    } catch (err) {
      return reply.code(422).send({
        error: { code: 'CSV_INVALID', message: (err as Error).message },
      });
    }

    const created: { line: number; slug: string }[] = [];
    const skipped: { line: number; reason: string }[] = [];
    const errors = [...mapped.errors];
    const categoryCache = new Map<string, string>(); // name → id

    for (const { line, row } of mapped.rows) {
      try {
        const slug = row.slug ?? slugify(row.title);

        // Idempotence: existing slug → skip (re-runs are safe)
        const [existing] = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(and(eq(schema.products.tenantId, auth.tenantId), eq(schema.products.slug, slug)))
          .limit(1);
        if (existing) {
          skipped.push({ line, reason: `Slug "${slug}" už existuje` });
          continue;
        }

        // Resolve/create the category by name (cached per import run)
        let categoryId: string | null = null;
        if (row.category) {
          const cached = categoryCache.get(row.category);
          if (cached) {
            categoryId = cached;
          } else {
            const catSlug = slugify(row.category);
            const [existingCat] = await db
              .select({ id: schema.categories.id })
              .from(schema.categories)
              .where(
                and(
                  eq(schema.categories.tenantId, auth.tenantId),
                  eq(schema.categories.slug, catSlug),
                ),
              )
              .limit(1);
            if (existingCat) {
              categoryId = existingCat.id;
            } else {
              const [cat] = await db
                .insert(schema.categories)
                .values({
                  tenantId: auth.tenantId,
                  pubId: generatePubId('cat'),
                  slug: catSlug,
                  name: row.category,
                  path: catSlug, // root category — matches POST /categories convention
                  status: 'active',
                })
                .returning({ id: schema.categories.id });
              categoryId = cat!.id;
            }
            categoryCache.set(row.category, categoryId);
          }
        }

        const productId = await db.transaction(async (tx) => {
          const [product] = await tx
            .insert(schema.products)
            .values({
              tenantId: auth.tenantId,
              pubId: generatePubId('prd'),
              slug,
              title: row.title,
              descriptionHtml: row.description,
              basePriceAmount: row.priceMinor,
              basePriceCurrency: 'CZK',
              status: 'active',
              publishedAt: new Date(),
              vendor: row.vendor,
              brandName: row.brand,
              createdByUserId: auth.userId,
            })
            .returning({ id: schema.products.id });

          const [variant] = await tx
            .insert(schema.productVariants)
            .values({
              tenantId: auth.tenantId,
              productId: product!.id,
              pubId: generatePubId('prv'),
              sku: row.sku,
              title: 'Default',
              priceAmount: row.priceMinor,
              priceCurrency: 'CZK',
              weightGrams: row.weightGrams,
              stockOnHand: row.stock,
            })
            .returning({ id: schema.productVariants.id });

          if (row.stock > 0) {
            await tx.insert(schema.stockMovements).values({
              tenantId: auth.tenantId,
              variantId: variant!.id,
              quantityDelta: row.stock,
              reason: 'initial_load',
              referenceType: 'manual',
              resultingStockOnHand: row.stock,
              actorUserId: auth.userId,
              note: 'CSV import',
            });
          }

          if (categoryId) {
            await tx.insert(schema.productCategories).values({
              tenantId: auth.tenantId,
              productId: product!.id,
              categoryId,
            });
          }
          return product!.id;
        });

        void indexProduct(config, db, productId, app.log);
        created.push({ line, slug });
      } catch (err) {
        const message =
          (err as { code?: string }).code === '23505'
            ? 'Duplicitní SKU nebo slug'
            : (err as Error).message;
        errors.push({ line, message });
      }
    }

    app.log.info(
      { tenantId: auth.tenantId, created: created.length, skipped: skipped.length, errors: errors.length },
      'products.import_complete',
    );
    return reply.send({
      data: {
        created: created.length,
        created_slugs: created.map((c) => c.slug),
        skipped,
        errors,
        total_rows: mapped.rows.length + mapped.errors.length,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /products/{id} — archive (soft)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/api/2026-05-20/products/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      if (!ensureTenant(auth, reply)) return;
      if (!ensurePermission(auth, PERMISSIONS.PRODUCT_DELETE, reply)) return;

      const { id } = req.params;
      const isPubId = id.startsWith('prd_');

      const result = await db
        .update(schema.products)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(
          and(
            eq(schema.products.tenantId, auth.tenantId),
            isPubId ? eq(schema.products.pubId, id) : eq(schema.products.id, id),
          ),
        )
        .returning({ id: schema.products.id });

      if (result.length === 0) {
        return reply.code(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
        });
      }

      void removeProductFromIndex(config, result[0]!.id, app.log);
      return reply.code(204).send();
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

function ensureTenant(auth: { tenantId: string }, reply: any): auth is { tenantId: string } {
  if (!auth.tenantId) {
    reply.code(412).send({
      error: {
        code: 'NO_TENANT_CONTEXT',
        message: 'JWT has no tenant. Call POST /auth/switch-tenant first.',
      },
    });
    return false;
  }
  return true;
}

function ensurePermission(
  auth: { permissions: readonly PermissionCode[] } & any,
  permission: PermissionCode,
  reply: any,
): boolean {
  if (!can(auth, permission)) {
    reply.code(403).send({
      error: {
        code: 'PERMISSION_DENIED',
        message: `Required permission: ${permission}`,
        required: permission,
      },
    });
    return false;
  }
  return true;
}

function serializeProduct(
  product: typeof schema.products.$inferSelect,
  variants: (typeof schema.productVariants.$inferSelect)[],
  media: (typeof schema.productMedia.$inferSelect)[],
  categoryIds: string[],
) {
  return {
    id: product.pubId,
    slug: product.slug,
    title: product.title,
    description_html: product.descriptionHtml,
    base_price_amount: product.basePriceAmount?.toString() ?? null,
    base_price_currency: product.basePriceCurrency,
    compare_at_amount: product.compareAtAmount?.toString() ?? null,
    status: product.status,
    vendor: product.vendor,
    brand_name: product.brandName,
    attributes: product.attributes,
    published_at: product.publishedAt,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    variants: variants.map((v) => ({
      id: v.pubId,
      sku: v.sku,
      barcode: v.barcode,
      title: v.title,
      price_amount: v.priceAmount.toString(),
      price_currency: v.priceCurrency,
      compare_at_amount: v.compareAtAmount?.toString() ?? null,
      weight_grams: v.weightGrams,
      requires_shipping: v.requiresShipping,
      stock_on_hand: v.stockOnHand,
      stock_reserved: v.stockReserved,
      stock_available: v.stockOnHand - v.stockReserved,
      allow_backorder: v.allowBackorder,
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
    category_ids: categoryIds,
  };
}

function zodErr(error: z.ZodError) {
  return {
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}
