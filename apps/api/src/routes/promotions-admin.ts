/**
 * Admin automatic promotions — per `10-pricing-promotions.md` (P2).
 *   GET    /admin/promotions
 *   POST   /admin/promotions
 *   PATCH  /admin/promotions/{pubId}
 *   DELETE /admin/promotions/{pubId}   — soft (is_active=false)
 *
 * No-code cart rules (Magento-style): order %/fixed/free-shipping with subtotal
 * + quantity conditions, and BOGO ("buy X get Y"). Evaluated in lib/promotions.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const minor = z.union([z.string(), z.number()]).transform((v) => BigInt(v));

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['order_percentage', 'order_fixed', 'free_shipping', 'bogo']),
  /** order_percentage: basis points (1500=15%); order_fixed: minor units. */
  value: minor.optional(),
  currency: z.string().length(3).optional(),
  maxDiscountAmount: minor.optional(),
  minSubtotal: minor.optional(),
  minQuantity: z.number().int().min(0).optional(),
  buyQuantity: z.number().int().min(0).optional(),
  getQuantity: z.number().int().min(0).optional(),
  getDiscountBps: z.number().int().min(0).max(10000).optional(),
  priority: z.number().int().optional(),
  stackable: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});
const UpdateBody = CreateBody.partial().extend({ isActive: z.boolean().optional() });

export async function registerPromotionAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/promotions', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.promotions)
        .where(eq(schema.promotions.tenantId, tenantId))
        .orderBy(desc(schema.promotions.priority), desc(schema.promotions.createdAt))
        .limit(200),
    );
    return reply.send({ data: { promotions: rows.map(serialize) } });
  });

  app.post('/api/2026-05-20/admin/promotions', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (i.kind === 'order_percentage' && (i.value == null || i.value <= 0n || i.value > 10000n)) {
      return reply.code(422).send({ error: { code: 'INVALID_PERCENTAGE', message: 'Procento 1–10000 bps' } });
    }
    if (i.kind === 'bogo' && (!i.buyQuantity || !i.getQuantity)) {
      return reply.code(422).send({ error: { code: 'INVALID_BOGO', message: 'BOGO vyžaduje buyQuantity + getQuantity' } });
    }
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.promotions)
        .values({
          tenantId,
          pubId: generatePubId('prm'),
          name: i.name,
          kind: i.kind,
          value: i.value ?? 0n,
          currency: i.currency ?? null,
          maxDiscountAmount: i.maxDiscountAmount ?? null,
          minSubtotal: i.minSubtotal ?? 0n,
          minQuantity: i.minQuantity ?? 0,
          buyQuantity: i.buyQuantity ?? 0,
          getQuantity: i.getQuantity ?? 0,
          getDiscountBps: i.getDiscountBps ?? 10000,
          priority: i.priority ?? 0,
          stackable: i.stackable ?? true,
          startsAt: i.startsAt ? new Date(i.startsAt) : null,
          endsAt: i.endsAt ? new Date(i.endsAt) : null,
        })
        .returning(),
    );
    return reply.code(201).send({ data: serialize(row!) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/promotions/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['name', 'kind', 'value', 'currency', 'maxDiscountAmount', 'minSubtotal', 'minQuantity', 'buyQuantity', 'getQuantity', 'getDiscountBps', 'priority', 'stackable', 'isActive'] as const) {
      if (i[k] !== undefined) updates[k] = i[k];
    }
    if (i.startsAt !== undefined) updates.startsAt = i.startsAt ? new Date(i.startsAt) : null;
    if (i.endsAt !== undefined) updates.endsAt = i.endsAt ? new Date(i.endsAt) : null;
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.promotions)
        .set(updates)
        .where(and(eq(schema.promotions.tenantId, tenantId), eq(schema.promotions.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound2(reply, 'PROMOTION_NOT_FOUND');
    return reply.send({ data: serialize(row) });
  });

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/promotions/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.promotions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(schema.promotions.tenantId, tenantId), eq(schema.promotions.pubId, req.params.pubId)))
        .returning({ id: schema.promotions.id }),
    );
    if (!row) return notFound2(reply, 'PROMOTION_NOT_FOUND');
    return reply.code(204).send();
  });
}

function serialize(p: typeof schema.promotions.$inferSelect) {
  return {
    id: p.pubId,
    name: p.name,
    kind: p.kind,
    value: p.value.toString(),
    currency: p.currency,
    max_discount_amount: p.maxDiscountAmount?.toString() ?? null,
    min_subtotal: p.minSubtotal.toString(),
    min_quantity: p.minQuantity,
    buy_quantity: p.buyQuantity,
    get_quantity: p.getQuantity,
    get_discount_bps: p.getDiscountBps,
    priority: p.priority,
    stackable: p.stackable,
    starts_at: p.startsAt,
    ends_at: p.endsAt,
    is_active: p.isActive,
    created_at: p.createdAt,
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
