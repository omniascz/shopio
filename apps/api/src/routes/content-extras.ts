/**
 * Content extras — glossary + poll (Shoptet "Slovník pojmů" + "Anketa").
 *
 * Admin (auth):
 *   GET/POST /admin/glossary
 *   GET/POST /admin/polls
 * Storefront (public):
 *   GET  /storefront/{slug}/glossary
 *   GET  /storefront/{slug}/poll                  — the active poll
 *   POST /storefront/{slug}/polls/{pubId}/vote    — { key }
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
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

interface PollOption {
  key: string;
  label: string;
  votes: number;
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant' } });
}
async function resolveTenantId(db: AppDb, slug: string): Promise<string | null> {
  const [t] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(and(eq(schema.tenants.slug, slug), eq(schema.tenants.status, 'active')))
    .limit(1);
  return t?.id ?? null;
}

export async function registerContentExtraRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  // ---- Glossary (admin) -----------------------------------------------------
  app.get('/api/2026-05-20/admin/glossary', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx.select().from(schema.glossaryTerms).where(eq(schema.glossaryTerms.tenantId, tenantId)).orderBy(asc(schema.glossaryTerms.term)),
    );
    return reply.send({ data: { terms: rows.map((t) => ({ id: t.pubId, term: t.term, slug: t.slug, definition_html: t.definitionHtml })) } });
  });

  app.post('/api/2026-05-20/admin/glossary', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = z
      .object({
        term: z.string().min(1).max(200),
        slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
        definitionHtml: z.string().min(1).max(20000),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid term' } });
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.glossaryTerms)
        .values({ tenantId, pubId: generatePubId('gls'), term: parsed.data.term, slug: parsed.data.slug, definitionHtml: parsed.data.definitionHtml })
        .returning(),
    );
    return reply.code(201).send({ data: { id: row!.pubId, term: row!.term, slug: row!.slug } });
  });

  // ---- Polls (admin) --------------------------------------------------------
  app.get('/api/2026-05-20/admin/polls', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx.select().from(schema.polls).where(eq(schema.polls.tenantId, tenantId)).orderBy(desc(schema.polls.createdAt)),
    );
    return reply.send({ data: { polls: rows.map((p) => ({ id: p.pubId, question: p.question, options: p.options, is_active: p.isActive })) } });
  });

  app.post('/api/2026-05-20/admin/polls', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = z
      .object({
        question: z.string().min(1).max(300),
        options: z.array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(200) })).min(2).max(10),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Anketa: otázka + 2–10 možností' } });
    const options: PollOption[] = parsed.data.options.map((o) => ({ key: o.key, label: o.label, votes: 0 }));
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx.insert(schema.polls).values({ tenantId, pubId: generatePubId('pol'), question: parsed.data.question, options }).returning(),
    );
    return reply.code(201).send({ data: { id: row!.pubId, question: row!.question, options: row!.options } });
  });

  // ---- Glossary (storefront, public) ----------------------------------------
  app.get<{ Params: { tenantSlug: string } }>('/api/2026-05-20/storefront/:tenantSlug/glossary', async (req, reply) => {
    const tenantId = await resolveTenantId(db, req.params.tenantSlug);
    if (!tenantId) return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Not found' } });
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx.select().from(schema.glossaryTerms).where(eq(schema.glossaryTerms.tenantId, tenantId)).orderBy(asc(schema.glossaryTerms.term)),
    );
    return reply
      .header('cache-control', 'public, max-age=600')
      .send({ data: { terms: rows.map((t) => ({ term: t.term, slug: t.slug, definition_html: t.definitionHtml })) } });
  });

  // ---- Poll (storefront, public) --------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>('/api/2026-05-20/storefront/:tenantSlug/poll', async (req, reply) => {
    const tenantId = await resolveTenantId(db, req.params.tenantSlug);
    if (!tenantId) return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Not found' } });
    const [poll] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.polls)
        .where(and(eq(schema.polls.tenantId, tenantId), eq(schema.polls.isActive, true)))
        .orderBy(desc(schema.polls.createdAt))
        .limit(1),
    );
    if (!poll) return reply.send({ data: { poll: null } });
    return reply.send({ data: { poll: { id: poll.pubId, question: poll.question, options: poll.options } } });
  });

  app.post<{ Params: { tenantSlug: string; pubId: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/polls/:pubId/vote',
    async (req, reply) => {
      const tenantId = await resolveTenantId(db, req.params.tenantSlug);
      if (!tenantId) return reply.code(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Not found' } });
      const parsed = z.object({ key: z.string().min(1).max(40) }).safeParse(req.body);
      if (!parsed.success) return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Chybí volba' } });
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const [poll] = await tx
          .select()
          .from(schema.polls)
          .where(and(eq(schema.polls.tenantId, tenantId), eq(schema.polls.pubId, req.params.pubId)))
          .for('update')
          .limit(1);
        if (!poll) return { notFound: true as const };
        const options = (poll.options as PollOption[]).map((o) =>
          o.key === parsed.data.key ? { ...o, votes: o.votes + 1 } : o,
        );
        if (!options.some((o) => o.key === parsed.data.key)) return { badOption: true as const };
        await tx.update(schema.polls).set({ options, updatedAt: new Date() }).where(eq(schema.polls.id, poll.id));
        return { options };
      });
      if ('notFound' in result) return reply.code(404).send({ error: { code: 'POLL_NOT_FOUND', message: 'Not found' } });
      if ('badOption' in result) return reply.code(422).send({ error: { code: 'BAD_OPTION', message: 'Neznámá volba' } });
      return reply.send({ data: { options: result.options } });
    },
  );
}
