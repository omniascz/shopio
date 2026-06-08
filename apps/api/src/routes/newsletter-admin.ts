/**
 * Admin email marketing — per `19` (P3). Subscribers + campaigns + send.
 *   GET    /admin/newsletter/subscribers
 *   GET    /admin/newsletter/campaigns
 *   POST   /admin/newsletter/campaigns
 *   PATCH  /admin/newsletter/campaigns/{pubId}
 *   DELETE /admin/newsletter/campaigns/{pubId}
 *   POST   /admin/newsletter/campaigns/{pubId}/send
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { sendCampaign } from '../lib/newsletter';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const CampaignBody = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().max(100_000).default(''),
});

export async function registerNewsletterAdminRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/newsletter/subscribers', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const { rows, active } = await withTenant(rlsDb, tenantId, async (tx) => {
      const rows = await tx
        .select({
          email: schema.newsletterSubscribers.email,
          status: schema.newsletterSubscribers.status,
          source: schema.newsletterSubscribers.source,
          created_at: schema.newsletterSubscribers.createdAt,
        })
        .from(schema.newsletterSubscribers)
        .where(eq(schema.newsletterSubscribers.tenantId, tenantId))
        .orderBy(desc(schema.newsletterSubscribers.createdAt))
        .limit(500);
      const [c] = await tx
        .select({ n: dsql<number>`count(*) filter (where status = 'active')::int` })
        .from(schema.newsletterSubscribers)
        .where(eq(schema.newsletterSubscribers.tenantId, tenantId));
      return { rows, active: c?.n ?? 0 };
    });
    return reply.send({ data: { active_count: active, subscribers: rows } });
  });

  app.get('/api/2026-05-20/admin/newsletter/campaigns', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.emailCampaigns)
        .where(eq(schema.emailCampaigns.tenantId, tenantId))
        .orderBy(desc(schema.emailCampaigns.createdAt))
        .limit(200),
    );
    return reply.send({ data: { campaigns: rows.map(serialize) } });
  });

  app.post('/api/2026-05-20/admin/newsletter/campaigns', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CampaignBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.emailCampaigns)
        .values({
          tenantId,
          pubId: generatePubId('cmp'),
          name: i.name,
          subject: i.subject,
          bodyHtml: i.bodyHtml,
          createdByUserId: req.auth!.userId ?? null,
        })
        .returning(),
    );
    return reply.code(201).send({ data: serialize(row!) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/newsletter/campaigns/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CampaignBody.partial().safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const updates: Record<string, unknown> = {};
    for (const k of ['name', 'subject', 'bodyHtml'] as const) {
      if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
    }
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.emailCampaigns)
        .set(updates)
        .where(
          and(
            eq(schema.emailCampaigns.tenantId, tenantId),
            eq(schema.emailCampaigns.pubId, req.params.pubId),
            eq(schema.emailCampaigns.status, 'draft'), // can't edit a sent campaign
          ),
        )
        .returning(),
    );
    if (!row) return notFound2(reply, 'CAMPAIGN_NOT_FOUND');
    return reply.send({ data: serialize(row) });
  });

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/newsletter/campaigns/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .delete(schema.emailCampaigns)
        .where(and(eq(schema.emailCampaigns.tenantId, tenantId), eq(schema.emailCampaigns.pubId, req.params.pubId)))
        .returning({ id: schema.emailCampaigns.id }),
    );
    if (!row) return notFound2(reply, 'CAMPAIGN_NOT_FOUND');
    return reply.code(204).send();
  });

  app.post<{ Params: { pubId: string } }>('/api/2026-05-20/admin/newsletter/campaigns/:pubId/send', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    // Resolve the campaign (must be draft) + tenant slug.
    const resolved = await withTenant(rlsDb, tenantId, async (tx) => {
      const [c] = await tx
        .select({ id: schema.emailCampaigns.id, status: schema.emailCampaigns.status })
        .from(schema.emailCampaigns)
        .where(and(eq(schema.emailCampaigns.tenantId, tenantId), eq(schema.emailCampaigns.pubId, req.params.pubId)))
        .limit(1);
      if (!c) return null;
      const [t] = await tx
        .select({ slug: schema.tenants.slug })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      return { campaign: c, slug: t?.slug ?? '' };
    });
    if (!resolved) return notFound2(reply, 'CAMPAIGN_NOT_FOUND');
    if (resolved.campaign.status !== 'draft') {
      return reply.code(409).send({ error: { code: 'ALREADY_SENT', message: 'Kampaň už byla odeslána' } });
    }
    const result = await sendCampaign(
      { db, config, log: app.log },
      tenantId,
      resolved.slug,
      resolved.campaign.id,
      config.SHOPIO_BASE_URL,
    );
    return reply.send({ data: result });
  });
}

function serialize(c: typeof schema.emailCampaigns.$inferSelect) {
  return {
    id: c.pubId,
    name: c.name,
    subject: c.subject,
    body_html: c.bodyHtml,
    status: c.status,
    recipient_count: c.recipientCount,
    sent_count: c.sentCount,
    sent_at: c.sentAt,
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
