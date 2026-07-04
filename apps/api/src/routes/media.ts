/**
 * Product media endpoints — per `06-catalog-pim.md` §3.7 MVP.
 *
 *   POST   /products/{id}/media           — multipart image upload → MinIO/S3
 *   PATCH  /products/{id}/media/{mediaId} — alt / primary / position
 *   DELETE /products/{id}/media/{mediaId}
 *
 * Files land in the public-read media bucket under
 * `media/{tenantId}/{productId}/{nanoid}.{ext}`; rows in `product_media`
 * carry the public URL (storefront + admin read it directly).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { deleteObject, putObject } from '../lib/storage';
import { indexProduct } from '../lib/search';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const PatchMediaBody = z.object({
  alt: z.string().max(255).nullable().optional(),
  isPrimary: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  // ---------------------------------------------------------------------------
  // POST /admin/media — tenant-scoped "quick upload" for the page builder / CMS
  // (per `32` media library MVP). Uploads to the public media bucket and returns
  // the URL; no DB row (the block/page JSON is the source of truth). A full
  // media library with tagging/search is Fáze 2.
  // ---------------------------------------------------------------------------
  app.post(
    '/api/2026-05-20/admin/media',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
      if (!file) {
        return reply.code(422).send({ error: { code: 'NO_FILE', message: 'Multipart file field required' } });
      }
      const ext = ALLOWED_MIME[file.mimetype];
      if (!ext) {
        return reply.code(422).send({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Unsupported type ${file.mimetype} (allowed: ${Object.keys(ALLOWED_MIME).join(', ')})`,
          },
        });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return reply.code(413).send({ error: { code: 'FILE_TOO_LARGE', message: `Max ${MAX_BYTES / 1024 / 1024} MB` } });
      }

      const key = `media/${tenantId}/library/${generatePubId('img')}.${ext}`;
      try {
        const uploaded = await putObject(config, key, buffer, file.mimetype);
        app.log.info({ tenantId, key, bytes: buffer.length }, 'media.library_uploaded');
        return reply.code(201).send({ data: { url: uploaded.url } });
      } catch (err) {
        app.log.error({ err, key }, 'media.library_upload_failed');
        return reply.code(502).send({ error: { code: 'STORAGE_ERROR', message: 'Object storage unavailable' } });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /products/{id}/media — multipart upload
  // ---------------------------------------------------------------------------
  app.post<{ Params: { productId: string } }>(
    '/api/2026-05-20/products/:productId/media',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const product = await findProduct(db, tenantId, req.params.productId);
      if (!product) return notFound(reply, 'PRODUCT_NOT_FOUND', 'Product not found');

      const file = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } });
      if (!file) {
        return reply.code(422).send({
          error: { code: 'NO_FILE', message: 'Multipart file field required' },
        });
      }
      const ext = ALLOWED_MIME[file.mimetype];
      if (!ext) {
        return reply.code(422).send({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Unsupported type ${file.mimetype} (allowed: ${Object.keys(ALLOWED_MIME).join(', ')})`,
          },
        });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return reply.code(413).send({
          error: { code: 'FILE_TOO_LARGE', message: `Max ${MAX_BYTES / 1024 / 1024} MB` },
        });
      }

      const key = `media/${tenantId}/${product.id}/${generatePubId('img')}.${ext}`;
      let uploaded;
      try {
        uploaded = await putObject(config, key, buffer, file.mimetype);
      } catch (err) {
        app.log.error({ err, key }, 'media.upload_failed');
        return reply.code(502).send({
          error: { code: 'STORAGE_ERROR', message: 'Object storage unavailable' },
        });
      }

      const row = await db.transaction(async (tx) => {
        const [agg] = await tx
          .select({
            maxPos: dsql<number>`COALESCE(MAX(${schema.productMedia.position}), -1)::int`,
            count: dsql<number>`COUNT(*)::int`,
          })
          .from(schema.productMedia)
          .where(eq(schema.productMedia.productId, product.id));

        const [inserted] = await tx
          .insert(schema.productMedia)
          .values({
            tenantId,
            productId: product.id,
            pubId: generatePubId('mda'),
            kind: 'image',
            url: uploaded.url,
            alt: (file.fields.alt as { value?: string } | undefined)?.value ?? null,
            bytes: buffer.length,
            mimeType: file.mimetype,
            position: (agg?.maxPos ?? -1) + 1,
            isPrimary: (agg?.count ?? 0) === 0, // first image becomes primary
            metadata: { storage_key: key },
          })
          .returning();
        return inserted!;
      });

      app.log.info({ productId: product.id, mediaId: row.id, bytes: buffer.length }, 'media.uploaded');
      void indexProduct(config, db, product.id, app.log); // primary image → search doc
      return reply.code(201).send({ data: serializeMedia(row) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /products/{id}/media/{mediaId}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { productId: string; mediaId: string } }>(
    '/api/2026-05-20/products/:productId/media/:mediaId',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchMediaBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_FAILED', message: 'Invalid input' },
        });
      }
      const input = parsed.data;

      const media = await findMedia(db, tenantId, req.params.productId, req.params.mediaId);
      if (!media) return notFound(reply, 'MEDIA_NOT_FOUND', 'Media not found');

      const updated = await db.transaction(async (tx) => {
        if (input.isPrimary) {
          await tx
            .update(schema.productMedia)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(eq(schema.productMedia.productId, media.productId));
        }
        const [row] = await tx
          .update(schema.productMedia)
          .set({
            ...(input.alt !== undefined && { alt: input.alt }),
            ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
            ...(input.position !== undefined && { position: input.position }),
            updatedAt: new Date(),
          })
          .where(eq(schema.productMedia.id, media.id))
          .returning();
        return row!;
      });

      void indexProduct(config, db, media.productId, app.log);
      return reply.send({ data: serializeMedia(updated) });
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /products/{id}/media/{mediaId}
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { productId: string; mediaId: string } }>(
    '/api/2026-05-20/products/:productId/media/:mediaId',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const media = await findMedia(db, tenantId, req.params.productId, req.params.mediaId);
      if (!media) return notFound(reply, 'MEDIA_NOT_FOUND', 'Media not found');

      await db.transaction(async (tx) => {
        await tx.delete(schema.productMedia).where(eq(schema.productMedia.id, media.id));
        // Primary fallback: promote the first remaining image
        if (media.isPrimary) {
          const [next] = await tx
            .select({ id: schema.productMedia.id })
            .from(schema.productMedia)
            .where(eq(schema.productMedia.productId, media.productId))
            .orderBy(asc(schema.productMedia.position))
            .limit(1);
          if (next) {
            await tx
              .update(schema.productMedia)
              .set({ isPrimary: true, updatedAt: new Date() })
              .where(eq(schema.productMedia.id, next.id));
          }
        }
      });

      // Best-effort object removal (row is the source of truth)
      const storageKey = (media.metadata as { storage_key?: string }).storage_key;
      if (storageKey) {
        void deleteObject(config, storageKey).catch((err) =>
          app.log.warn({ err, storageKey }, 'media.object_delete_failed'),
        );
      }

      void indexProduct(config, db, media.productId, app.log);
      return reply.code(204).send();
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

async function findProduct(db: AppDb, tenantId: string, idOrPub: string) {
  const [product] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.tenantId, tenantId),
        idOrPub.startsWith('prd_')
          ? eq(schema.products.pubId, idOrPub)
          : eq(schema.products.id, idOrPub),
      ),
    )
    .limit(1);
  return product ?? null;
}

async function findMedia(db: AppDb, tenantId: string, productIdOrPub: string, mediaPub: string) {
  const product = await findProduct(db, tenantId, productIdOrPub);
  if (!product) return null;
  const [media] = await db
    .select()
    .from(schema.productMedia)
    .where(
      and(
        eq(schema.productMedia.tenantId, tenantId),
        eq(schema.productMedia.productId, product.id),
        mediaPub.startsWith('mda_')
          ? eq(schema.productMedia.pubId, mediaPub)
          : eq(schema.productMedia.id, mediaPub),
      ),
    )
    .limit(1);
  return media ?? null;
}

function serializeMedia(m: typeof schema.productMedia.$inferSelect) {
  return {
    id: m.pubId,
    kind: m.kind,
    url: m.url,
    alt: m.alt,
    bytes: m.bytes,
    mime_type: m.mimeType,
    position: m.position,
    is_primary: m.isPrimary,
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({
    error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
  });
}

function notFound(reply: any, code: string, message: string) {
  return reply.code(404).send({ error: { code, message } });
}
