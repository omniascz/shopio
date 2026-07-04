/**
 * Admin CMS — content pages + blog posts per `32-cms-content.md` MVP.
 *
 *   GET/POST/PATCH/DELETE  /admin/cms/pages[/:pubId]
 *   GET/POST/PATCH/DELETE  /admin/cms/blog-posts[/:pubId]
 *
 * Body is merchant-authored HTML (lightly sanitized — script/handlers stripped;
 * full DOMPurify deferred). Slug unique per tenant; publishing sets published_at.
 *
 * Deferred (per `32`): blocks/page builder, revisions, translations, forms,
 * menus, redirects, scheduling, tags/categories, AI.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql as dsql, type AnyColumn } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { withTenant } from '@shopio/db';
import { requirePermission } from '../plugins/auth-middleware';
import { BlocksSchema } from '../lib/page-blocks';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug smí obsahovat jen malá písmena, číslice a pomlčky');

const PageCreate = z.object({
  slug,
  title: z.string().min(1).max(200),
  bodyHtml: z.string().max(200_000).optional(),
  /** Page-builder blocks (per `32`). When non-empty the storefront renders
   * these instead of body_html. Validated against the block model. */
  blocks: BlocksSchema.optional(),
  status: z.enum(['draft', 'published']).optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
});
const PageUpdate = PageCreate.partial();

const PostCreate = PageCreate.extend({
  excerpt: z.string().max(500).nullable().optional(),
  coverImageUrl: z.string().max(1000).nullable().optional(),
});
const PostUpdate = PostCreate.partial();

/** Minimal HTML guard (MVP). Strips <script>, event handlers, javascript: URLs. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

export async function registerCmsAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  // ===== PAGES ===============================================================
  app.get('/api/2026-05-20/admin/cms/pages', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.cmsPages)
        .where(eq(schema.cmsPages.tenantId, tenantId))
        .orderBy(desc(schema.cmsPages.updatedAt))
        .limit(500),
    );
    return reply.send({ data: { pages: rows.map(serializePage) } });
  });

  app.post('/api/2026-05-20/admin/cms/pages', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = PageCreate.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const published = i.status === 'published';
    try {
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .insert(schema.cmsPages)
          .values({
            tenantId,
            pubId: generatePubId('pag'),
            slug: i.slug,
            title: i.title,
            bodyHtml: sanitizeHtml(i.bodyHtml ?? ''),
            blocks: i.blocks ?? [],
            status: i.status ?? 'draft',
            seoTitle: i.seoTitle ?? null,
            seoDescription: i.seoDescription ?? null,
            publishedAt: published ? new Date() : null,
          })
          .returning(),
      );
      return reply.code(201).send({ data: serializePage(row!) });
    } catch (err) {
      return slugConflict(reply, err);
    }
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/pages/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.cmsPages)
        .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
        .limit(1),
    );
    if (!row) return notFound(reply, 'PAGE_NOT_FOUND');
    return reply.send({ data: serializePage(row) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/pages/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = PageUpdate.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    try {
      const updates = buildContentUpdates(parsed.data);
      const editsContent =
        parsed.data.title !== undefined ||
        parsed.data.bodyHtml !== undefined ||
        parsed.data.blocks !== undefined;
      const row = await withTenant(rlsDb, tenantId, async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.cmsPages)
          .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
          .limit(1);
        if (!current) return null;
        // Snapshot the pre-edit content into history (per `32` §5.7) before we
        // overwrite it — only when the edit actually touches content.
        if (editsContent) {
          updates.revisions = pushRevision(current.revisions, {
            at: new Date().toISOString(),
            title: current.title,
            body_html: current.bodyHtml,
            blocks: current.blocks,
          });
        }
        const [updated] = await tx
          .update(schema.cmsPages)
          .set(applyPublish(updates, parsed.data.status, schema.cmsPages))
          .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
          .returning();
        return updated ?? null;
      });
      if (!row) return notFound(reply, 'PAGE_NOT_FOUND');
      return reply.send({ data: serializePage(row) });
    } catch (err) {
      return slugConflict(reply, err);
    }
  });

  // GET /admin/cms/pages/:pubId/revisions — lightweight history list (newest
  // first): timestamp + title + whether it used blocks. Body/blocks omitted here
  // (fetched on restore) to keep the list small.
  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/pages/:pubId/revisions', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select({ revisions: schema.cmsPages.revisions })
        .from(schema.cmsPages)
        .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
        .limit(1),
    );
    if (!row) return notFound(reply, 'PAGE_NOT_FOUND');
    const revs = (row.revisions as PageRevision[]) ?? [];
    return reply.send({
      data: {
        revisions: revs.map((r, index) => ({
          index,
          at: r.at,
          title: r.title,
          block_count: Array.isArray(r.blocks) ? r.blocks.length : 0,
        })),
      },
    });
  });

  // POST /admin/cms/pages/:pubId/revisions/:index/restore — restore a past
  // snapshot. The current content is first snapshotted (so a restore is itself
  // undoable), then title/body/blocks are replaced from the chosen revision.
  app.post<{ Params: { pubId: string; index: string } }>(
    '/api/2026-05-20/admin/cms/pages/:pubId/revisions/:index/restore',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const idx = Number.parseInt(req.params.index, 10);
      if (!Number.isInteger(idx) || idx < 0) {
        return reply.code(422).send({ error: { code: 'BAD_INDEX', message: 'Neplatný index revize' } });
      }
      const row = await withTenant(rlsDb, tenantId, async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.cmsPages)
          .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
          .limit(1);
        if (!current) return null;
        const revs = (current.revisions as PageRevision[]) ?? [];
        const target = revs[idx];
        if (!target) return 'NO_REV' as const;
        const revisions = pushRevision(current.revisions, {
          at: new Date().toISOString(),
          title: current.title,
          body_html: current.bodyHtml,
          blocks: current.blocks,
        });
        const [updated] = await tx
          .update(schema.cmsPages)
          .set({
            title: target.title,
            bodyHtml: target.body_html ?? '',
            blocks: target.blocks ?? [],
            revisions,
            updatedAt: new Date(),
          })
          .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
          .returning();
        return updated ?? null;
      });
      if (!row) return notFound(reply, 'PAGE_NOT_FOUND');
      if (row === 'NO_REV') return notFound(reply, 'REVISION_NOT_FOUND');
      return reply.send({ data: serializePage(row) });
    },
  );

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/pages/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .delete(schema.cmsPages)
        .where(and(eq(schema.cmsPages.tenantId, tenantId), eq(schema.cmsPages.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound(reply, 'PAGE_NOT_FOUND');
    return reply.send({ data: { ok: true } });
  });

  // ===== BLOG POSTS ==========================================================
  app.get('/api/2026-05-20/admin/cms/blog-posts', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.cmsBlogPosts)
        .where(eq(schema.cmsBlogPosts.tenantId, tenantId))
        .orderBy(desc(schema.cmsBlogPosts.updatedAt))
        .limit(500),
    );
    return reply.send({ data: { posts: rows.map(serializePost) } });
  });

  app.post('/api/2026-05-20/admin/cms/blog-posts', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = PostCreate.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const published = i.status === 'published';
    try {
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .insert(schema.cmsBlogPosts)
          .values({
            tenantId,
            pubId: generatePubId('pst'),
            slug: i.slug,
            title: i.title,
            excerpt: i.excerpt ?? null,
            coverImageUrl: i.coverImageUrl ?? null,
            bodyHtml: sanitizeHtml(i.bodyHtml ?? ''),
            status: i.status ?? 'draft',
            seoTitle: i.seoTitle ?? null,
            seoDescription: i.seoDescription ?? null,
            publishedAt: published ? new Date() : null,
          })
          .returning(),
      );
      return reply.code(201).send({ data: serializePost(row!) });
    } catch (err) {
      return slugConflict(reply, err);
    }
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/blog-posts/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.cmsBlogPosts)
        .where(and(eq(schema.cmsBlogPosts.tenantId, tenantId), eq(schema.cmsBlogPosts.pubId, req.params.pubId)))
        .limit(1),
    );
    if (!row) return notFound(reply, 'POST_NOT_FOUND');
    return reply.send({ data: serializePost(row) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/blog-posts/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = PostUpdate.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const p = parsed.data;
    try {
      const updates = buildContentUpdates(p);
      if (p.excerpt !== undefined) updates.excerpt = p.excerpt;
      if (p.coverImageUrl !== undefined) updates.coverImageUrl = p.coverImageUrl;
      const [row] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.cmsBlogPosts)
          .set(applyPublish(updates, p.status, schema.cmsBlogPosts))
          .where(and(eq(schema.cmsBlogPosts.tenantId, tenantId), eq(schema.cmsBlogPosts.pubId, req.params.pubId)))
          .returning(),
      );
      if (!row) return notFound(reply, 'POST_NOT_FOUND');
      return reply.send({ data: serializePost(row) });
    } catch (err) {
      return slugConflict(reply, err);
    }
  });

  app.delete<{ Params: { pubId: string } }>('/api/2026-05-20/admin/cms/blog-posts/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .delete(schema.cmsBlogPosts)
        .where(and(eq(schema.cmsBlogPosts.tenantId, tenantId), eq(schema.cmsBlogPosts.pubId, req.params.pubId)))
        .returning(),
    );
    if (!row) return notFound(reply, 'POST_NOT_FOUND');
    return reply.send({ data: { ok: true } });
  });
}

// ===== helpers ===============================================================

/** A stored content snapshot (per `32` §5.7). */
interface PageRevision {
  at: string;
  title: string;
  body_html: string;
  blocks: unknown;
}

const MAX_REVISIONS = 10;

/** Prepend a snapshot to the history, newest-first, capped to MAX_REVISIONS. */
function pushRevision(existing: unknown, rev: PageRevision): PageRevision[] {
  const prior = Array.isArray(existing) ? (existing as PageRevision[]) : [];
  return [rev, ...prior].slice(0, MAX_REVISIONS);
}

function buildContentUpdates(p: {
  slug?: string | undefined;
  title?: string | undefined;
  bodyHtml?: string | undefined;
  blocks?: unknown;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
}): Record<string, unknown> {
  const u: Record<string, unknown> = { updatedAt: new Date() };
  if (p.slug !== undefined) u.slug = p.slug;
  if (p.title !== undefined) u.title = p.title;
  if (p.bodyHtml !== undefined) u.bodyHtml = sanitizeHtml(p.bodyHtml);
  if (p.blocks !== undefined) u.blocks = p.blocks;
  if (p.seoTitle !== undefined) u.seoTitle = p.seoTitle;
  if (p.seoDescription !== undefined) u.seoDescription = p.seoDescription;
  return u;
}

/** Set published_at the first time status flips to published (COALESCE keeps
 *  the original publish date on subsequent saves). */
function applyPublish(
  updates: Record<string, unknown>,
  status: string | undefined,
  table: { publishedAt: AnyColumn },
): Record<string, unknown> {
  if (status !== undefined) {
    updates.status = status;
    if (status === 'published') {
      updates.publishedAt = dsql`COALESCE(${table.publishedAt}, now())`;
    }
  }
  return updates;
}

function serializePage(p: typeof schema.cmsPages.$inferSelect) {
  return {
    id: p.pubId,
    slug: p.slug,
    title: p.title,
    body_html: p.bodyHtml,
    blocks: p.blocks,
    status: p.status,
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    published_at: p.publishedAt,
    updated_at: p.updatedAt,
  };
}

function serializePost(p: typeof schema.cmsBlogPosts.$inferSelect) {
  return {
    id: p.pubId,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    cover_image_url: p.coverImageUrl,
    body_html: p.bodyHtml,
    status: p.status,
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    published_at: p.publishedAt,
    updated_at: p.updatedAt,
  };
}

function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function slugConflict(reply: any, err: unknown) {
  if ((err as { code?: string }).code === '23505') {
    return reply.code(409).send({ error: { code: 'SLUG_TAKEN', message: 'Tento slug už existuje' } });
  }
  throw err;
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
