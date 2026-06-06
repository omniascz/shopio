/**
 * Admin review moderation — per `19-marketing-seo.md`.
 *   GET   /admin/reviews?status=        — queue across products
 *   PATCH /admin/reviews/{pubId}        — { status }
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const ListQuery = z.object({
  status: z.enum(['published', 'pending', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const PatchBody = z.object({
  status: z.enum(['published', 'pending', 'rejected']),
});

export async function registerReviewAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db } = opts;

  app.get(
    '/api/2026-05-20/admin/reviews',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid query' } });
      }
      const { status, limit, offset } = parsed.data;
      const conditions = [eq(schema.productReviews.tenantId, tenantId)];
      if (status) conditions.push(eq(schema.productReviews.status, status));

      const [rows, countRow] = await Promise.all([
        db
          .select({
            pubId: schema.productReviews.pubId,
            rating: schema.productReviews.rating,
            title: schema.productReviews.title,
            body: schema.productReviews.body,
            authorName: schema.productReviews.authorName,
            verifiedPurchase: schema.productReviews.verifiedPurchase,
            status: schema.productReviews.status,
            createdAt: schema.productReviews.createdAt,
            productSlug: schema.products.slug,
            productTitle: schema.products.title,
          })
          .from(schema.productReviews)
          .innerJoin(schema.products, eq(schema.products.id, schema.productReviews.productId))
          .where(and(...conditions))
          .orderBy(desc(schema.productReviews.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: dsql<number>`COUNT(*)::int` })
          .from(schema.productReviews)
          .where(and(...conditions)),
      ]);

      return reply.send({
        data: {
          reviews: rows.map((r) => ({
            id: r.pubId,
            rating: r.rating,
            title: r.title,
            body: r.body,
            author: r.authorName,
            verified_purchase: r.verifiedPurchase,
            status: r.status,
            created_at: r.createdAt,
            product: { slug: r.productSlug, title: r.productTitle },
          })),
          total: countRow[0]?.count ?? 0,
          offset,
          limit,
        },
      });
    },
  );

  app.patch<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/reviews/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({ error: { code: 'VALIDATION_FAILED', message: 'Invalid status' } });
      }

      const [updated] = await db
        .update(schema.productReviews)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(
          and(
            eq(schema.productReviews.tenantId, tenantId),
            eq(schema.productReviews.pubId, req.params.pubId),
          ),
        )
        .returning({ pubId: schema.productReviews.pubId, status: schema.productReviews.status });
      if (!updated) {
        return reply.code(404).send({ error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found' } });
      }
      return reply.send({ data: { id: updated.pubId, status: updated.status } });
    },
  );
}

function noTenant(reply: any) {
  return reply.code(400).send({
    error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
  });
}
