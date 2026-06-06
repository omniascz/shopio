/**
 * Admin developer platform (per `28-developer-platform.md` MVP):
 *   API keys:   GET/POST /admin/api-keys, POST /admin/api-keys/:pubId/revoke
 *   Webhooks:   GET/POST /admin/webhooks, POST /admin/webhooks/:pubId/{disable,resume},
 *               GET /admin/webhooks/:pubId/deliveries,
 *               POST /admin/webhooks/deliveries/:pubId/replay
 *
 * Secrets (API key + webhook signing secret) are shown ONCE on create. All
 * queries RLS-scoped via withTenant.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { generateApiKey, serializeApiKey } from '../lib/api-keys';
import { WEBHOOK_TOPICS, generateWebhookSecret } from '../lib/webhooks-out';
import type { ShopioConfig } from '../config';
import type { AppDb } from '../db';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const VALID_PERMS = new Set<string>(Object.values(PERMISSIONS));

const CreateKeyBody = z.object({
  name: z.string().min(1).max(120),
  permissions: z.array(z.string()).min(1).max(40),
});

const CreateWebhookBody = z.object({
  url: z.string().url().max(1000),
  topics: z.array(z.enum(WEBHOOK_TOPICS)).min(1),
});

export async function registerDeveloperAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  // ===== API KEYS ============================================================
  app.get('/api/2026-05-20/admin/api-keys', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.tenantId, tenantId))
        .orderBy(desc(schema.apiKeys.createdAt))
        .limit(200),
    );
    return reply.send({ data: { api_keys: rows.map(serializeApiKey) } });
  });

  app.post('/api/2026-05-20/admin/api-keys', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateKeyBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const perms = parsed.data.permissions.filter((p) => VALID_PERMS.has(p));
    if (perms.length === 0) {
      return reply.code(422).send({ error: { code: 'NO_VALID_PERMISSIONS', message: 'Žádná platná oprávnění' } });
    }
    const gen = generateApiKey();
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.apiKeys)
        .values({
          tenantId,
          pubId: generatePubId('akey'),
          name: parsed.data.name,
          keyPrefix: gen.prefix,
          keyHint: gen.hint,
          keyHash: gen.hash,
          permissions: perms,
          createdByUserId: req.auth!.userId,
        })
        .returning(),
    );
    // Plaintext key returned exactly once.
    return reply.code(201).send({ data: { ...serializeApiKey(row!), key: gen.raw } });
  });

  app.post<{ Params: { pubId: string } }>('/api/2026-05-20/admin/api-keys/:pubId/revoke', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.apiKeys)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(and(eq(schema.apiKeys.tenantId, tenantId), eq(schema.apiKeys.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound(reply, 'API_KEY_NOT_FOUND');
    return reply.send({ data: serializeApiKey(row) });
  });

  // ===== WEBHOOKS ============================================================
  app.get('/api/2026-05-20/admin/webhooks', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.webhookEndpoints)
        .where(eq(schema.webhookEndpoints.tenantId, tenantId))
        .orderBy(desc(schema.webhookEndpoints.createdAt))
        .limit(200),
    );
    return reply.send({ data: { webhooks: rows.map(serializeEndpoint), available_topics: WEBHOOK_TOPICS } });
  });

  app.post('/api/2026-05-20/admin/webhooks', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateWebhookBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const { secret, hint } = generateWebhookSecret();
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.webhookEndpoints)
        .values({
          tenantId,
          pubId: generatePubId('whe'),
          url: parsed.data.url,
          secretHash: secret, // shared HMAC secret (kept to sign), shown once
          secretHint: hint,
          topics: parsed.data.topics,
          createdByUserId: req.auth!.userId,
        })
        .returning(),
    );
    return reply.code(201).send({ data: { ...serializeEndpoint(row!), secret } });
  });

  for (const [action, patch] of [
    ['disable', { enabled: false }],
    ['resume', { enabled: true, paused: false, consecutiveFailures: 0 }],
  ] as const) {
    app.post<{ Params: { pubId: string } }>(`/api/2026-05-20/admin/webhooks/:pubId/${action}`, guard, async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.webhookEndpoints)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(schema.webhookEndpoints.tenantId, tenantId), eq(schema.webhookEndpoints.pubId, req.params.pubId)))
          .returning(),
      );
      if (!row) return notFound(reply, 'WEBHOOK_NOT_FOUND');
      return reply.send({ data: serializeEndpoint(row) });
    });
  }

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/webhooks/:pubId/deliveries', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const result = await withTenant(rlsDb, tenantId, async (tx) => {
      const [ep] = await tx
        .select({ id: schema.webhookEndpoints.id })
        .from(schema.webhookEndpoints)
        .where(and(eq(schema.webhookEndpoints.tenantId, tenantId), eq(schema.webhookEndpoints.pubId, req.params.pubId)))
        .limit(1);
      if (!ep) return null;
      return tx
        .select({
          id: schema.webhookDeliveries.pubId,
          eventType: schema.webhookDeliveries.eventType,
          status: schema.webhookDeliveries.status,
          attempts: schema.webhookDeliveries.attempts,
          responseCode: schema.webhookDeliveries.responseCode,
          lastError: schema.webhookDeliveries.lastError,
          createdAt: schema.webhookDeliveries.createdAt,
          deliveredAt: schema.webhookDeliveries.deliveredAt,
        })
        .from(schema.webhookDeliveries)
        .where(eq(schema.webhookDeliveries.endpointId, ep.id))
        .orderBy(desc(schema.webhookDeliveries.createdAt))
        .limit(100);
    });
    if (!result) return notFound(reply, 'WEBHOOK_NOT_FOUND');
    return reply.send({
      data: {
        deliveries: result.map((d) => ({
          id: d.id,
          event_type: d.eventType,
          status: d.status,
          attempts: d.attempts,
          response_code: d.responseCode,
          last_error: d.lastError,
          created_at: d.createdAt,
          delivered_at: d.deliveredAt,
        })),
      },
    });
  });

  // Re-queue one delivery (sweep picks it up on the next event / immediately here).
  app.post<{ Params: { pubId: string } }>('/api/2026-05-20/admin/webhooks/deliveries/:pubId/replay', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.webhookDeliveries)
        .set({ status: 'pending', nextAttemptAt: new Date() })
        .where(and(eq(schema.webhookDeliveries.tenantId, tenantId), eq(schema.webhookDeliveries.pubId, req.params.pubId)))
        .returning({ id: schema.webhookDeliveries.id }),
    );
    if (!row) return notFound(reply, 'DELIVERY_NOT_FOUND');
    return reply.send({ data: { ok: true, message: 'Doručení znovu zařazeno; proběhne při dalším webhook eventu.' } });
  });
}

function serializeEndpoint(e: typeof schema.webhookEndpoints.$inferSelect) {
  return {
    id: e.pubId,
    url: e.url,
    secret_hint: e.secretHint,
    topics: e.topics,
    enabled: e.enabled,
    paused: e.paused,
    consecutive_failures: e.consecutiveFailures,
    created_at: e.createdAt,
  };
}

function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
