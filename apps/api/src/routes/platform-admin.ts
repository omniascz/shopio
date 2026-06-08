/**
 * Platform master-admin back-office (per `36-personas-rbac.md`) — cross-tenant
 * operator tooling that the per-tenant admin lacks: list/suspend/activate
 * tenants, set their plan from above, and see platform-wide totals.
 *
 * Access: the authenticated user's e-mail must be in PLATFORM_ADMIN_EMAILS
 * (config allowlist). These endpoints intentionally read across tenants using
 * the superuser pool (RLS bypass) — they are operator-only.
 *
 *   GET  /platform/me                         — am I a platform admin?
 *   GET  /platform/stats                      — totals (tenants, orders, MRR est.)
 *   GET  /platform/tenants                    — all tenants + plan + usage
 *   POST /platform/tenants/{pubId}/suspend    — block the shop
 *   POST /platform/tenants/{pubId}/activate   — re-enable
 *   POST /platform/tenants/{pubId}/plan       — set tier from above
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { requireAuth } from '../plugins/auth-middleware';
import { PLANS, planCodeOf } from '../lib/plans';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

function allowlist(config: ShopioConfig): Set<string> {
  return new Set(
    config.PLATFORM_ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Resolve whether the authenticated user is a platform operator. */
async function isPlatformAdmin(
  db: AppDb,
  config: ShopioConfig,
  userId: string | undefined,
): Promise<boolean> {
  const allow = allowlist(config);
  if (allow.size === 0 || !userId) return false;
  const [user] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return Boolean(user && allow.has(user.email.toLowerCase()));
}

export async function registerPlatformAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  /** Gate run AFTER requireAuth (req.auth is set): allowlist check. */
  const platformGate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await isPlatformAdmin(db, config, req.auth?.userId))) {
      return reply.code(403).send({
        error: { code: 'NOT_PLATFORM_ADMIN', message: 'Platform operator access required' },
      });
    }
  };
  const requirePlatform = [requireAuth, platformGate];

  // GET /platform/me — UI uses this to show/hide the back-office.
  app.get('/api/2026-05-20/platform/me', { preHandler: requireAuth }, async (req, reply) => {
    const ok = await isPlatformAdmin(db, config, req.auth?.userId);
    return reply.send({ data: { is_platform_admin: ok } });
  });

  // GET /platform/stats
  app.get('/api/2026-05-20/platform/stats', { preHandler: requirePlatform }, async (_req, reply) => {
    const tenants = await db
      .select({ status: schema.tenants.status, settings: schema.tenants.settings })
      .from(schema.tenants);
    const byStatus: Record<string, number> = {};
    let mrrEur = 0;
    for (const t of tenants) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (t.status === 'active') mrrEur += PLANS[planCodeOf(t.settings)].priceEurMonth;
    }
    const oRows = await db.select({ orders: dsql<number>`count(*)::int` }).from(schema.orders);
    const orders = oRows[0]?.orders ?? 0;
    return reply.send({
      data: {
        tenants_total: tenants.length,
        tenants_by_status: byStatus,
        orders_total: orders,
        mrr_eur_estimate: mrrEur,
      },
    });
  });

  // GET /platform/tenants
  app.get('/api/2026-05-20/platform/tenants', { preHandler: requirePlatform }, async (_req, reply) => {
    const rows = await db
      .select({
        pubId: schema.tenants.pubId,
        slug: schema.tenants.slug,
        displayName: schema.tenants.displayName,
        status: schema.tenants.status,
        countryCode: schema.tenants.countryCode,
        defaultCurrency: schema.tenants.defaultCurrency,
        settings: schema.tenants.settings,
        createdAt: schema.tenants.createdAt,
        products: dsql<number>`(SELECT count(*)::int FROM products WHERE products.tenant_id = tenants.id AND products.status <> 'archived')`,
        orders: dsql<number>`(SELECT count(*)::int FROM orders WHERE orders.tenant_id = tenants.id)`,
      })
      .from(schema.tenants)
      .orderBy(dsql`${schema.tenants.createdAt} DESC`);
    return reply.send({
      data: {
        tenants: rows.map((t) => ({
          id: t.pubId,
          slug: t.slug,
          display_name: t.displayName,
          status: t.status,
          country_code: t.countryCode,
          currency: t.defaultCurrency,
          plan: planCodeOf(t.settings),
          products: t.products,
          orders: t.orders,
          created_at: t.createdAt,
        })),
      },
    });
  });

  // POST /platform/tenants/{pubId}/suspend|activate
  for (const [action, status] of [
    ['suspend', 'suspended'],
    ['activate', 'active'],
  ] as const) {
    app.post<{ Params: { pubId: string } }>(
      `/api/2026-05-20/platform/tenants/:pubId/${action}`,
      { preHandler: requirePlatform },
      async (req, reply) => {
        const [updated] = await db
          .update(schema.tenants)
          .set({ status, statusEnteredAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.tenants.pubId, req.params.pubId))
          .returning({ pubId: schema.tenants.pubId, status: schema.tenants.status });
        if (!updated) {
          return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Not found' } });
        }
        app.log.warn({ tenant: updated.pubId, status }, 'platform.tenant_status_changed');
        return reply.send({ data: { id: updated.pubId, status: updated.status } });
      },
    );
  }

  // POST /platform/tenants/{pubId}/plan
  app.post<{ Params: { pubId: string }; Body: { plan?: string } }>(
    '/api/2026-05-20/platform/tenants/:pubId/plan',
    { preHandler: requirePlatform },
    async (req, reply) => {
      const parsed = z.object({ plan: z.enum(['free', 'growth', 'scale', 'pro']) }).safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Neplatný tarif' } });
      }
      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.pubId, req.params.pubId))
        .limit(1);
      if (!tenant) {
        return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Not found' } });
      }
      const settings = { ...(tenant.settings as Record<string, unknown>), plan: parsed.data.plan };
      await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.pubId, req.params.pubId));
      app.log.info({ tenant: req.params.pubId, plan: parsed.data.plan }, 'platform.tenant_plan_set');
      return reply.send({ data: { id: req.params.pubId, plan: parsed.data.plan } });
    },
  );
}
