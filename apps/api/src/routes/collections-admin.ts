/**
 * Admin dynamic collections — per `06`/`08` (P3 smart collections).
 *   GET    /admin/collections
 *   POST   /admin/collections
 *   PATCH  /admin/collections/{pubId}
 *   DELETE /admin/collections/{pubId}
 *   GET    /admin/collections/{pubId}/preview   — resolved products
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { resolveCollection, type CollectionRules } from '../lib/collections';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: malá písmena, číslice, pomlčky');

const RulesSchema = z.object({
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  onSaleOnly: z.boolean().optional(),
  inStockOnly: z.boolean().optional(),
  brand: z.string().max(120).optional(),
  vendor: z.string().max(120).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).optional(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  slug,
  description: z.string().max(2000).nullable().optional(),
  rules: RulesSchema.default({}),
  position: z.number().int().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});
const UpdateBody = CreateBody.partial().extend({ isActive: z.boolean().optional() });

export async function registerCollectionAdminRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/collections', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.collections)
        .where(eq(schema.collections.tenantId, tenantId))
        .orderBy(desc(schema.collections.position), desc(schema.collections.createdAt))
        .limit(200),
    );
    return reply.send({ data: { collections: rows.map(serialize) } });
  });

  app.post('/api/2026-05-20/admin/collections', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    try {
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .insert(schema.collections)
          .values({
            tenantId,
            pubId: generatePubId('col'),
            name: i.name,
            slug: i.slug,
            description: i.description ?? null,
            rules: i.rules,
            position: i.position ?? 0,
            seoTitle: i.seoTitle ?? null,
            seoDescription: i.seoDescription ?? null,
          })
          .returning(),
      );
      return reply.code(201).send({ data: serialize(row!) });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: { code: 'SLUG_TAKEN', message: 'Slug už existuje' } });
      }
      throw err;
    }
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/collections/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['name', 'slug', 'description', 'rules', 'position', 'seoTitle', 'seoDescription', 'isActive'] as const) {
      if (i[k] !== undefined) updates[k] = i[k];
    }
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.collections)
        .set(updates)
        .where(and(eq(schema.collections.tenantId, tenantId), eq(schema.collections.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound2(reply, 'COLLECTION_NOT_FOUND');
    return reply.send({ data: serialize(row) });
  });

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/collections/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .delete(schema.collections)
        .where(and(eq(schema.collections.tenantId, tenantId), eq(schema.collections.pubId, req.params.pubId)))
        .returning({ id: schema.collections.id }),
    );
    if (!row) return notFound2(reply, 'COLLECTION_NOT_FOUND');
    return reply.code(204).send();
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/collections/:pubId/preview', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const products = await withTenant(rlsDb, tenantId, async (tx) => {
      const [col] = await tx
        .select()
        .from(schema.collections)
        .where(and(eq(schema.collections.tenantId, tenantId), eq(schema.collections.pubId, req.params.pubId)))
        .limit(1);
      if (!col) return null;
      return resolveCollection(tx, tenantId, col.rules as CollectionRules, 24);
    });
    if (products === null) return notFound2(reply, 'COLLECTION_NOT_FOUND');
    return reply.send({ data: { products } });
  });
}

function serialize(c: typeof schema.collections.$inferSelect) {
  return {
    id: c.pubId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    rules: c.rules,
    position: c.position,
    is_active: c.isActive,
    seo_title: c.seoTitle,
    seo_description: c.seoDescription,
    created_at: c.createdAt,
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' } });
}
function notFound2(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
