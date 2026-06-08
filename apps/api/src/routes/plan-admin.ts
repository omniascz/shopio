/**
 * Platform plan + usage (per `37`). Shows the merchant their tier, limits and
 * current usage, and lets them switch tier. MVP: switching just records the
 * plan (no charge) — real Stripe billing of the merchant is the follow-up.
 *
 *   GET  /admin/plan   — current plan + catalog of tiers + usage
 *   POST /admin/plan   — switch tier (self-serve, unbilled in MVP)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { PLANS, PLAN_ORDER, planCodeOf, type PlanCode } from '../lib/plans';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const SetPlanBody = z.object({ plan: z.enum(['free', 'growth', 'scale', 'pro']) });

export async function registerPlanAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db } = opts;
  const rlsDb = getRlsDb(opts.config);

  app.get(
    '/api/2026-05-20/admin/plan',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return noTenant(reply);
      const current = planCodeOf(tenant.settings);

      // Usage: non-archived products + orders placed this month.
      const monthStart = (() => {
        const d = new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
      })();
      const usage = await withTenant(rlsDb, tenantId, async (tx) => {
        const pRows = await tx
          .select({ products: dsql<number>`count(*)::int` })
          .from(schema.products)
          .where(
            and(eq(schema.products.tenantId, tenantId), dsql`${schema.products.status} <> 'archived'`),
          );
        const oRows = await tx
          .select({ orders: dsql<number>`count(*)::int` })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.tenantId, tenantId),
              dsql`${schema.orders.placedAt} >= ${monthStart}`,
            ),
          );
        return { products: pRows[0]?.products ?? 0, orders: oRows[0]?.orders ?? 0 };
      });

      return reply.send({
        data: {
          current_plan: current,
          plans: PLAN_ORDER.map((code) => PLANS[code]),
          usage: {
            products: usage.products,
            orders_this_month: usage.orders,
            max_products: PLANS[current].maxProducts,
            max_orders_per_month: PLANS[current].maxOrdersPerMonth,
          },
        },
      });
    },
  );

  app.post(
    '/api/2026-05-20/admin/plan',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = SetPlanBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Neplatný tarif' } });
      }
      const next: PlanCode = parsed.data.plan;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return noTenant(reply);

      const settings = { ...(tenant.settings as Record<string, unknown>), plan: next };
      await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId));

      app.log.info({ tenantId, plan: next }, 'plan.changed');
      return reply.send({
        data: {
          current_plan: next,
          note: 'Tarif změněn. Fakturace tarifu bude doplněna (zatím bez platby).',
        },
      });
    },
  );
}

function noTenant(reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
