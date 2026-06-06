/**
 * Admin marketplace — vendor management + commission ledger (per `25` MVP).
 *
 *   GET/POST            /admin/vendors
 *   GET/PATCH           /admin/vendors/{pubId}
 *   GET                 /admin/vendors/{pubId}/products
 *   GET                 /admin/vendors/{pubId}/commissions   (ledger + totals)
 *
 * Payment-independent: no payouts/balances. Vendor self-service portal + vendor
 * payouts are deferred (per `25`). All queries RLS-scoped via withTenant.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { serializeVendor } from '../lib/marketplace';
import type { ShopioConfig } from '../config';
import type { AppDb } from '../db';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: malá písmena, číslice, pomlčky');

const CreateBody = z.object({
  displayName: z.string().min(1).max(200),
  slug: slug.optional(),
  contactEmail: z.string().email().toLowerCase(),
  contactPhone: z.string().max(40).optional(),
  legalEntityName: z.string().max(200).optional(),
  registrationNumber: z.string().max(40).optional(),
  vatId: z.string().max(40).optional(),
  commissionBasisPoints: z.number().int().min(0).max(10000).optional(),
});

const UpdateBody = z.object({
  displayName: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().toLowerCase().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  legalEntityName: z.string().max(200).nullable().optional(),
  registrationNumber: z.string().max(40).nullable().optional(),
  vatId: z.string().max(40).nullable().optional(),
  status: z.enum(['pending', 'active', 'suspended', 'closed']).optional(),
  commissionBasisPoints: z.number().int().min(0).max(10000).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export async function registerMarketplaceAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/vendors', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select({
          vendor: schema.vendors,
          products: dsql<number>`(
            SELECT count(*)::int FROM products WHERE products.vendor_id = vendors.id
          )`,
          earnings: dsql<string>`(
            SELECT COALESCE(SUM(vendor_earning_amount), 0)::text
            FROM marketplace_commissions WHERE marketplace_commissions.vendor_id = vendors.id
          )`,
        })
        .from(schema.vendors)
        .where(eq(schema.vendors.tenantId, tenantId))
        .orderBy(desc(schema.vendors.createdAt))
        .limit(500),
    );
    return reply.send({
      data: {
        vendors: rows.map((r) => ({
          ...serializeVendor(r.vendor),
          products: r.products,
          vendor_earnings: r.earnings,
        })),
      },
    });
  });

  app.post('/api/2026-05-20/admin/vendors', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    try {
      const [vendor] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .insert(schema.vendors)
          .values({
            tenantId,
            pubId: generatePubId('ven'),
            slug: i.slug ?? slugify(i.displayName),
            displayName: i.displayName,
            contactEmail: i.contactEmail,
            contactPhone: i.contactPhone ?? null,
            legalEntityName: i.legalEntityName ?? null,
            registrationNumber: i.registrationNumber ?? null,
            vatId: i.vatId ?? null,
            commissionBasisPoints: i.commissionBasisPoints ?? 1500,
          })
          .returning(),
      );
      return reply.code(201).send({ data: serializeVendor(vendor!) });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: { code: 'SLUG_TAKEN', message: 'Slug už existuje' } });
      }
      throw err;
    }
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/vendors/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const [vendor] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.vendors)
        .where(and(eq(schema.vendors.tenantId, tenantId), eq(schema.vendors.pubId, req.params.pubId)))
        .limit(1),
    );
    if (!vendor) return notFound(reply, 'VENDOR_NOT_FOUND');
    return reply.send({ data: serializeVendor(vendor) });
  });

  app.patch<{ Params: { pubId: string } }>('/api/2026-05-20/admin/vendors/:pubId', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['displayName', 'contactEmail', 'contactPhone', 'legalEntityName', 'registrationNumber', 'vatId', 'status', 'commissionBasisPoints'] as const) {
      if (i[k] !== undefined) updates[k] = i[k];
    }
    const [vendor] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .update(schema.vendors)
        .set(updates)
        .where(and(eq(schema.vendors.tenantId, tenantId), eq(schema.vendors.pubId, req.params.pubId)))
        .returning(),
    );
    if (!vendor) return notFound(reply, 'VENDOR_NOT_FOUND');
    return reply.send({ data: serializeVendor(vendor) });
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/vendors/:pubId/products', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const result = await withTenant(rlsDb, tenantId, async (tx) => {
      const [vendor] = await tx
        .select({ id: schema.vendors.id })
        .from(schema.vendors)
        .where(and(eq(schema.vendors.tenantId, tenantId), eq(schema.vendors.pubId, req.params.pubId)))
        .limit(1);
      if (!vendor) return null;
      const products = await tx
        .select({
          id: schema.products.pubId,
          title: schema.products.title,
          slug: schema.products.slug,
          status: schema.products.status,
        })
        .from(schema.products)
        .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.vendorId, vendor.id)))
        .orderBy(desc(schema.products.createdAt))
        .limit(500);
      return products;
    });
    if (!result) return notFound(reply, 'VENDOR_NOT_FOUND');
    return reply.send({ data: { products: result } });
  });

  app.get<{ Params: { pubId: string } }>('/api/2026-05-20/admin/vendors/:pubId/commissions', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const result = await withTenant(rlsDb, tenantId, async (tx) => {
      const [vendor] = await tx
        .select({ id: schema.vendors.id })
        .from(schema.vendors)
        .where(and(eq(schema.vendors.tenantId, tenantId), eq(schema.vendors.pubId, req.params.pubId)))
        .limit(1);
      if (!vendor) return null;
      const [totals] = await tx
        .select({
          lines: dsql<number>`COUNT(*)::int`,
          commission: dsql<string>`COALESCE(SUM(${schema.marketplaceCommissions.commissionAmount}), 0)::text`,
          earning: dsql<string>`COALESCE(SUM(${schema.marketplaceCommissions.vendorEarningAmount}), 0)::text`,
        })
        .from(schema.marketplaceCommissions)
        .where(eq(schema.marketplaceCommissions.vendorId, vendor.id));
      const rows = await tx
        .select({
          orderNumber: schema.orders.orderNumber,
          currency: schema.marketplaceCommissions.currency,
          lineSubtotal: schema.marketplaceCommissions.lineSubtotalAmount,
          commission: schema.marketplaceCommissions.commissionAmount,
          earning: schema.marketplaceCommissions.vendorEarningAmount,
          createdAt: schema.marketplaceCommissions.createdAt,
        })
        .from(schema.marketplaceCommissions)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.marketplaceCommissions.orderId))
        .where(eq(schema.marketplaceCommissions.vendorId, vendor.id))
        .orderBy(desc(schema.marketplaceCommissions.createdAt))
        .limit(200);
      return { totals, rows };
    });
    if (!result) return notFound(reply, 'VENDOR_NOT_FOUND');
    return reply.send({
      data: {
        totals: {
          lines: result.totals?.lines ?? 0,
          commission: result.totals?.commission ?? '0',
          vendor_earnings: result.totals?.earning ?? '0',
        },
        commissions: result.rows.map((r) => ({
          order_number: r.orderNumber,
          currency: r.currency,
          line_subtotal: r.lineSubtotal.toString(),
          commission: r.commission.toString(),
          vendor_earning: r.earning.toString(),
          created_at: r.createdAt,
        })),
      },
    });
  });
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
