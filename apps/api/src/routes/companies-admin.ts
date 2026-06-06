/**
 * Admin B2B company management — per `21-b2b-complete.md` MVP.
 *   GET    /admin/companies            — list companies (with linked customers count)
 *   PATCH  /admin/companies/{pubId}    — grant/revoke NET terms, edit details
 *
 * NET terms (pay-on-invoice) are a merchant-granted privilege: customers can
 * fill their company billing profile themselves, but only an admin can flip
 * `net_terms_enabled` / `net_terms_days`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { withTenant } from '@shopio/db';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { serializeCompany } from '../lib/companies';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const UpdateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  registrationNumber: z.string().max(40).nullable().optional(),
  vatId: z.string().max(40).nullable().optional(),
  netTermsEnabled: z.boolean().optional(),
  netTermsDays: z.number().int().min(1).max(180).optional(),
});

export async function registerCompanyAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);

  app.get(
    '/api/2026-05-20/admin/companies',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select({
            company: schema.companies,
            members: dsql<number>`(
              SELECT count(*)::int FROM ${schema.customers}
              WHERE ${schema.customers.companyId} = ${schema.companies.id}
            )`,
          })
          .from(schema.companies)
          .where(eq(schema.companies.tenantId, tenantId))
          .orderBy(desc(schema.companies.createdAt))
          .limit(500),
      );
      return reply.send({
        data: {
          companies: rows.map((r) => ({ ...serializeCompany(r.company), members: r.members })),
        },
      });
    },
  );

  app.patch<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/companies/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const k of ['name', 'registrationNumber', 'vatId', 'netTermsEnabled', 'netTermsDays'] as const) {
        if (i[k] !== undefined) updates[k] = i[k];
      }

      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.companies)
          .set(updates)
          .where(
            and(eq(schema.companies.tenantId, tenantId), eq(schema.companies.pubId, req.params.pubId)),
          )
          .returning(),
      );
      if (!updated) return notFound(reply, 'COMPANY_NOT_FOUND');
      return reply.send({ data: serializeCompany(updated) });
    },
  );
}

function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  });
}
