/**
 * Admin coupon management — per `10-pricing-promotions.md`.
 *   GET    /admin/coupons
 *   POST   /admin/coupons
 *   PATCH  /admin/coupons/{pubId}
 *   DELETE /admin/coupons/{pubId}   — soft (is_active=false)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { withTenant } from '@shopio/db';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const moneyToMinor = z
  .union([z.string(), z.number()])
  .transform((v) => BigInt(v))
  .optional();

const CreateBody = z.object({
  code: z
    .string()
    .min(2)
    .max(60)
    .transform((s) => s.trim().toUpperCase()),
  description: z.string().max(500).optional(),
  kind: z.enum(['percentage', 'fixed', 'free_shipping']),
  /** percentage: basis points (1500=15%); fixed: minor units. */
  value: z.union([z.string(), z.number()]).transform((v) => BigInt(v)).default(0),
  currency: z.string().length(3).optional(),
  maxDiscountAmount: moneyToMinor,
  minPurchaseAmount: z.union([z.string(), z.number()]).transform((v) => BigInt(v)).default(0),
  maxUsesTotal: z.number().int().positive().nullable().optional(),
  maxUsesPerCustomer: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const UpdateBody = CreateBody.partial().extend({
  isActive: z.boolean().optional(),
});

export async function registerCouponAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  // RLS-enforced pool (per `30`): tenant-isolation policies confine every query
  // run via withTenant; the explicit tenant filters below are kept as
  // defense-in-depth.
  const rlsDb = getRlsDb(opts.config);

  app.get(
    '/api/2026-05-20/admin/coupons',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.coupons)
          .where(eq(schema.coupons.tenantId, tenantId))
          .orderBy(desc(schema.coupons.createdAt))
          .limit(200),
      );
      return reply.send({ data: { coupons: rows.map(serialize) } });
    },
  );

  app.post(
    '/api/2026-05-20/admin/coupons',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;
      if (input.kind === 'percentage' && (input.value <= 0n || input.value > 10000n)) {
        return reply.code(422).send({
          error: { code: 'INVALID_PERCENTAGE', message: 'Procento musí být 1–10000 bazických bodů (1–100 %)' },
        });
      }

      try {
        const [coupon] = await withTenant(rlsDb, tenantId, (tx) =>
          tx
            .insert(schema.coupons)
            .values({
              tenantId,
              pubId: generatePubId('cpn'),
              code: input.code,
              description: input.description ?? null,
              kind: input.kind,
              value: input.value,
              currency: input.currency ?? null,
              maxDiscountAmount: input.maxDiscountAmount ?? null,
              minPurchaseAmount: input.minPurchaseAmount,
              maxUsesTotal: input.maxUsesTotal ?? null,
              maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
              startsAt: input.startsAt ? new Date(input.startsAt) : null,
              endsAt: input.endsAt ? new Date(input.endsAt) : null,
            })
            .returning(),
        );
        return reply.code(201).send({ data: serialize(coupon!) });
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.code(409).send({
            error: { code: 'CODE_TAKEN', message: 'Kód už existuje' },
          });
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/coupons/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const k of ['code', 'description', 'kind', 'value', 'currency', 'maxDiscountAmount', 'minPurchaseAmount', 'maxUsesTotal', 'maxUsesPerCustomer', 'isActive'] as const) {
        if (i[k] !== undefined) updates[k] = i[k];
      }
      if (i.startsAt !== undefined) updates.startsAt = i.startsAt ? new Date(i.startsAt) : null;
      if (i.endsAt !== undefined) updates.endsAt = i.endsAt ? new Date(i.endsAt) : null;

      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.coupons)
          .set(updates)
          .where(and(eq(schema.coupons.tenantId, tenantId), eq(schema.coupons.pubId, req.params.pubId)))
          .returning(),
      );
      if (!updated) return notFound2(reply, 'COUPON_NOT_FOUND');
      return reply.send({ data: serialize(updated) });
    },
  );

  app.delete<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/coupons/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.coupons)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(schema.coupons.tenantId, tenantId), eq(schema.coupons.pubId, req.params.pubId)))
          .returning({ id: schema.coupons.id }),
      );
      if (!updated) return notFound2(reply, 'COUPON_NOT_FOUND');
      return reply.code(204).send();
    },
  );
}

function serialize(c: typeof schema.coupons.$inferSelect) {
  return {
    id: c.pubId,
    code: c.code,
    description: c.description,
    kind: c.kind,
    value: c.value.toString(),
    currency: c.currency,
    max_discount_amount: c.maxDiscountAmount?.toString() ?? null,
    min_purchase_amount: c.minPurchaseAmount.toString(),
    max_uses_total: c.maxUsesTotal,
    max_uses_per_customer: c.maxUsesPerCustomer,
    usage_count: c.usageCount,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    is_active: c.isActive,
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
