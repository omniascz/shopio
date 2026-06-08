/**
 * Admin automation flows — per `28` / P3 (BaseLinker Automatic Actions style).
 *   GET    /admin/flows
 *   POST   /admin/flows
 *   PATCH  /admin/flows/{pubId}
 *   DELETE /admin/flows/{pubId}
 *   GET    /admin/flows/meta   — triggers, fields, ops, action types (for the UI)
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

const ConditionSchema = z.object({
  field: z.enum(['total', 'currency', 'country', 'payment_method', 'item_count', 'has_coupon', 'status']),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
});
const ActionSchema = z.object({
  type: z.enum(['add_tag', 'set_note', 'email_merchant']),
  tag: z.string().max(60).optional(),
  note: z.string().max(500).optional(),
  to: z.string().email().optional(),
  subject: z.string().max(200).optional(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  triggerEvent: z.enum(['order.placed', 'order.paid', 'order.fulfilled', 'order.cancelled']),
  conditions: z.array(ConditionSchema).max(20).default([]),
  actions: z.array(ActionSchema).min(1).max(10),
  priority: z.number().int().optional(),
});
const UpdateBody = CreateBody.partial().extend({ isActive: z.boolean().optional() });

export async function registerFlowAdminRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/flows/meta', guard, async (_req, reply) => {
    return reply.send({
      data: {
        triggers: ['order.placed', 'order.paid', 'order.fulfilled', 'order.cancelled'],
        fields: ['total', 'currency', 'country', 'payment_method', 'item_count', 'has_coupon', 'status'],
        operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'],
        action_types: ['add_tag', 'set_note', 'email_merchant'],
      },
    });
  });

  app.get('/api/2026-05-20/admin/flows', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.flows)
        .where(eq(schema.flows.tenantId, tenantId))
        .orderBy(desc(schema.flows.priority), desc(schema.flows.createdAt))
        .limit(200),
    );
    return reply.send({ data: { flows: rows.map(serialize) } });
  });

  app.post('/api/2026-05-20/admin/flows', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.flows)
        .values({
          tenantId,
          pubId: generatePubId('flw'),
          name: i.name,
          triggerEvent: i.triggerEvent,
          conditions: i.conditions,
          actions: i.actions,
          priority: i.priority ?? 0,
        })
        .returning(),
    );
    return reply.code(201).send({ data: serialize(row!) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/flows/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['name', 'triggerEvent', 'conditions', 'actions', 'priority', 'isActive'] as const) {
      if (i[k] !== undefined) updates[k] = i[k];
    }
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.flows)
        .set(updates)
        .where(and(eq(schema.flows.tenantId, tenantId), eq(schema.flows.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound2(reply, 'FLOW_NOT_FOUND');
    return reply.send({ data: serialize(row) });
  });

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/flows/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .delete(schema.flows)
        .where(and(eq(schema.flows.tenantId, tenantId), eq(schema.flows.pubId, req.params.pubId)))
        .returning({ id: schema.flows.id }),
    );
    if (!row) return notFound2(reply, 'FLOW_NOT_FOUND');
    return reply.code(204).send();
  });
}

function serialize(f: typeof schema.flows.$inferSelect) {
  return {
    id: f.pubId,
    name: f.name,
    trigger_event: f.triggerEvent,
    conditions: f.conditions,
    actions: f.actions,
    priority: f.priority,
    is_active: f.isActive,
    last_run_at: f.lastRunAt,
    run_count: f.runCount,
    created_at: f.createdAt,
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
