/**
 * Admin bundle composition — per `06-catalog-pim.md` §6.5.
 *   GET    /admin/products/{productPubId}/bundle-items
 *   POST   /admin/products/{productPubId}/bundle-items   — add child variant
 *   PATCH  /admin/products/{productPubId}/bundle-items/{itemId}
 *   DELETE /admin/products/{productPubId}/bundle-items/{itemId}
 *
 * Adding the first item flips the product to `type='bundle'`; removing the last
 * flips it back to `simple` (the invariant: a bundle has ≥1 items). Cycles are
 * rejected (RULE-PRODUCT-004). The bundle keeps its own price (RULE-PRODUCT-013).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import { findBundleCycle, loadBundleComponents } from '../lib/bundles';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const AddBody = z.object({
  childVariantId: z.string().min(1), // variant pub_id
  quantity: z.number().int().min(1).max(999).default(1),
  isOptional: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

const PatchBody = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  isOptional: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export async function registerBundleAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);

  app.get<{ Params: { productPubId: string } }>(
    '/api/2026-05-20/admin/products/:productPubId/bundle-items',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const data = await withTenant(rlsDb, tenantId, async (tx) => {
        const bundle = await resolveProduct(tx, tenantId, req.params.productPubId);
        if (!bundle) return null;
        return loadBundleComponents(tx, tenantId, bundle.id);
      });
      if (data === null) return notFound2(reply, 'PRODUCT_NOT_FOUND');
      return reply.send({ data: { bundle_items: data.map(serialize) } });
    },
  );

  app.post<{ Params: { productPubId: string } }>(
    '/api/2026-05-20/admin/products/:productPubId/bundle-items',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = AddBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;

      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const bundle = await resolveProduct(tx, tenantId, req.params.productPubId);
        if (!bundle) return { err: 'PRODUCT_NOT_FOUND' as const };
        const variant = await resolveVariant(tx, tenantId, i.childVariantId);
        if (!variant) return { err: 'VARIANT_NOT_FOUND' as const };
        // A bundle cannot contain its own variants.
        if (variant.productId === bundle.id) return { err: 'SELF_REFERENCE' as const };
        const cycle = await findBundleCycle(tx, tenantId, bundle.id, [variant.id]);
        if (cycle) return { err: 'CYCLE' as const };

        // Pre-check the unique (bundle, child) constraint — a failed INSERT would
        // poison the surrounding transaction, so we don't rely on catching 23505.
        const [dupe] = await tx
          .select({ id: schema.productBundleItems.id })
          .from(schema.productBundleItems)
          .where(
            and(
              eq(schema.productBundleItems.bundleId, bundle.id),
              eq(schema.productBundleItems.childVariantId, variant.id),
            ),
          )
          .limit(1);
        if (dupe) return { err: 'DUPLICATE' as const };

        const [item] = await tx
          .insert(schema.productBundleItems)
          .values({
            tenantId,
            bundleId: bundle.id,
            childVariantId: variant.id,
            quantity: i.quantity,
            isOptional: i.isOptional,
            position: i.position,
          })
          .returning({ id: schema.productBundleItems.id });
        // Flip the product to a bundle on first component.
        if (bundle.type !== 'bundle') {
          await tx
            .update(schema.products)
            .set({ type: 'bundle', updatedAt: new Date() })
            .where(eq(schema.products.id, bundle.id));
        }
        return { id: item!.id };
      });

      if ('err' in result) {
        const map: Record<string, [number, string, string]> = {
          PRODUCT_NOT_FOUND: [404, 'PRODUCT_NOT_FOUND', 'Produkt nenalezen'],
          VARIANT_NOT_FOUND: [404, 'VARIANT_NOT_FOUND', 'Varianta nenalezena'],
          SELF_REFERENCE: [422, 'SELF_REFERENCE', 'Bundle nemůže obsahovat vlastní variantu'],
          CYCLE: [422, 'BUNDLE_CYCLE', 'Tato varianta by vytvořila cyklus'],
          DUPLICATE: [409, 'DUPLICATE_ITEM', 'Varianta už je v bundlu'],
        };
        const [code, errCode, msg] = map[result.err]!;
        return reply.code(code).send({ error: { code: errCode, message: msg } });
      }
      return reply.code(201).send({ data: { id: result.id } });
    },
  );

  app.patch<{ Params: { productPubId: string; itemId: string } }>(
    '/api/2026-05-20/admin/products/:productPubId/bundle-items/:itemId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = PatchBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;
      const updates: Record<string, unknown> = {};
      if (i.quantity !== undefined) updates.quantity = i.quantity;
      if (i.isOptional !== undefined) updates.isOptional = i.isOptional;
      if (i.position !== undefined) updates.position = i.position;
      if (Object.keys(updates).length === 0) return reply.send({ data: { updated: false } });

      const updated = await withTenant(rlsDb, tenantId, async (tx) => {
        const bundle = await resolveProduct(tx, tenantId, req.params.productPubId);
        if (!bundle) return null;
        const [row] = await tx
          .update(schema.productBundleItems)
          .set(updates)
          .where(
            and(
              eq(schema.productBundleItems.tenantId, tenantId),
              eq(schema.productBundleItems.bundleId, bundle.id),
              eq(schema.productBundleItems.id, req.params.itemId),
            ),
          )
          .returning({ id: schema.productBundleItems.id });
        return row ?? null;
      });
      if (!updated) return notFound2(reply, 'BUNDLE_ITEM_NOT_FOUND');
      return reply.send({ data: { updated: true } });
    },
  );

  app.delete<{ Params: { productPubId: string; itemId: string } }>(
    '/api/2026-05-20/admin/products/:productPubId/bundle-items/:itemId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const ok = await withTenant(rlsDb, tenantId, async (tx) => {
        const bundle = await resolveProduct(tx, tenantId, req.params.productPubId);
        if (!bundle) return false;
        const [row] = await tx
          .delete(schema.productBundleItems)
          .where(
            and(
              eq(schema.productBundleItems.tenantId, tenantId),
              eq(schema.productBundleItems.bundleId, bundle.id),
              eq(schema.productBundleItems.id, req.params.itemId),
            ),
          )
          .returning({ id: schema.productBundleItems.id });
        if (!row) return false;
        // Last component removed → revert to a simple product (invariant).
        const remaining = await tx
          .select({ id: schema.productBundleItems.id })
          .from(schema.productBundleItems)
          .where(eq(schema.productBundleItems.bundleId, bundle.id))
          .limit(1);
        if (remaining.length === 0) {
          await tx
            .update(schema.products)
            .set({ type: 'simple', updatedAt: new Date() })
            .where(eq(schema.products.id, bundle.id));
        }
        return true;
      });
      if (!ok) return notFound2(reply, 'BUNDLE_ITEM_NOT_FOUND');
      return reply.code(204).send();
    },
  );
}

async function resolveProduct(tx: TenantTx, tenantId: string, pubId: string) {
  const [p] = await tx
    .select({ id: schema.products.id, type: schema.products.type })
    .from(schema.products)
    .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.pubId, pubId)))
    .limit(1);
  return p ?? null;
}

async function resolveVariant(tx: TenantTx, tenantId: string, pubId: string) {
  const [v] = await tx
    .select({ id: schema.productVariants.id, productId: schema.productVariants.productId })
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.tenantId, tenantId), eq(schema.productVariants.pubId, pubId)))
    .limit(1);
  return v ?? null;
}

function serialize(c: Awaited<ReturnType<typeof loadBundleComponents>>[number]) {
  return {
    id: c.id,
    child_variant_id: c.childVariantPubId,
    product_id: c.productPubId,
    product_slug: c.productSlug,
    title: c.title,
    variant_title: c.variantTitle,
    sku: c.sku,
    quantity: c.quantity,
    is_optional: c.isOptional,
    position: c.position,
    available_units: c.availableUnits,
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
