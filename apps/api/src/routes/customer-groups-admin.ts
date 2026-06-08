/**
 * Admin customer-group management — wholesale / B2B price levels
 * (Shoptet "Velkoobchod"). A group applies a % goods discount to its members.
 *
 *   GET  /admin/customer-groups
 *   POST /admin/customer-groups                 — { name, discountBps }
 *   POST /admin/customer-groups/{pubId}/members — { email }  (assign a customer)
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

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  discountBps: z.number().int().min(0).max(9000), // up to 90 % off
});

function serialize(g: typeof schema.customerGroups.$inferSelect) {
  return { id: g.pubId, name: g.name, discount_bps: g.discountBps, created_at: g.createdAt };
}

export async function registerCustomerGroupAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);

  app.get(
    '/api/2026-05-20/admin/customer-groups',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_ACCESS)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant' } });
      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.customerGroups)
          .where(eq(schema.customerGroups.tenantId, tenantId))
          .orderBy(desc(schema.customerGroups.createdAt)),
      );
      return reply.send({ data: { groups: rows.map(serialize) } });
    },
  );

  app.post(
    '/api/2026-05-20/admin/customer-groups',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant' } });
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid group', field_errors: parsed.error.flatten().fieldErrors } });
      }
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .insert(schema.customerGroups)
          .values({ tenantId, pubId: generatePubId('cgr'), name: parsed.data.name, discountBps: parsed.data.discountBps })
          .returning(),
      );
      return reply.code(201).send({ data: serialize(row!) });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/customer-groups/:pubId/members',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant' } });
      const parsed = z.object({ email: z.string().email().toLowerCase() }).safeParse(req.body);
      if (!parsed.success) return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid email' } });
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const [group] = await tx
          .select({ id: schema.customerGroups.id })
          .from(schema.customerGroups)
          .where(and(eq(schema.customerGroups.tenantId, tenantId), eq(schema.customerGroups.pubId, req.params.pubId)))
          .limit(1);
        if (!group) return { notFound: 'group' as const };
        const [updated] = await tx
          .update(schema.customers)
          .set({ customerGroupId: group.id, updatedAt: new Date() })
          .where(and(eq(schema.customers.tenantId, tenantId), eq(schema.customers.email, parsed.data.email)))
          .returning({ id: schema.customers.id });
        if (!updated) return { notFound: 'customer' as const };
        return { ok: true as const };
      });
      if ('notFound' in result) return reply.code(404).send({ error: { code: `${result.notFound!.toUpperCase()}_NOT_FOUND`, message: 'Not found' } });
      return reply.send({ data: { assigned: true } });
    },
  );
}
