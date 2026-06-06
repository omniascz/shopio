/**
 * Admin i18n — locale settings + translation editor (per `23-i18n.md` MVP).
 *
 *   GET  /admin/locale-settings              — default + enabled + available
 *   PUT  /admin/locale-settings              — set enabled locales
 *   GET  /admin/translations?entityType&entityId  — master + per-locale values
 *   PUT  /admin/translations                 — upsert a locale's field values
 *
 * Deferred (per `23`): versioning/history, AI translation, import/export.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { AVAILABLE_LOCALES, TRANSLATABLE_FIELDS, type EntityType } from '../lib/translations';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const LocaleSettingsBody = z.object({
  enabledLocales: z.array(z.string().min(2).max(10)).min(1),
});

const TranslationQuery = z.object({
  entityType: z.enum(['product', 'category']),
  entityId: z.string().min(1), // pub_id
});

const TranslationBody = z.object({
  entityType: z.enum(['product', 'category']),
  entityId: z.string().min(1), // pub_id
  locale: z.string().min(2).max(10),
  fields: z.record(z.string(), z.string()),
});

export async function registerTranslationAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db } = opts;

  // ---------------------------------------------------------------------------
  // GET /admin/locale-settings
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/locale-settings',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [t] = await db
        .select({
          defaultLocale: schema.tenants.defaultLocale,
          enabledLocales: schema.tenants.enabledLocales,
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!t) return noTenant(reply);
      return reply.send({
        data: {
          default_locale: t.defaultLocale,
          enabled_locales: (t.enabledLocales as string[]) ?? [t.defaultLocale],
          available_locales: AVAILABLE_LOCALES,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PUT /admin/locale-settings
  // ---------------------------------------------------------------------------
  app.put(
    '/api/2026-05-20/admin/locale-settings',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = LocaleSettingsBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const [t] = await db
        .select({ defaultLocale: schema.tenants.defaultLocale })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!t) return noTenant(reply);

      const valid = new Set(AVAILABLE_LOCALES.map((l) => l.code));
      // The default locale is always enabled; dedupe + validate the rest.
      const enabled = Array.from(new Set([t.defaultLocale, ...parsed.data.enabledLocales])).filter(
        (l) => valid.has(l),
      );

      await db
        .update(schema.tenants)
        .set({ enabledLocales: enabled, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId));
      return reply.send({ data: { enabled_locales: enabled } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/translations?entityType=&entityId=
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/translations',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = TranslationQuery.safeParse(req.query);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { entityType } = parsed.data;

      const resolved = await resolveEntity(db, tenantId, entityType, parsed.data.entityId);
      if (!resolved) return notFound(reply, 'ENTITY_NOT_FOUND');

      const rows = await db
        .select({
          field: schema.translations.field,
          locale: schema.translations.locale,
          value: schema.translations.value,
        })
        .from(schema.translations)
        .where(
          and(
            eq(schema.translations.tenantId, tenantId),
            eq(schema.translations.entityType, entityType),
            eq(schema.translations.entityId, resolved.id),
          ),
        );

      // byLocale[locale][field] = value
      const byLocale: Record<string, Record<string, string>> = {};
      for (const r of rows) {
        (byLocale[r.locale] ??= {})[r.field] = r.value;
      }

      return reply.send({
        data: {
          entity_type: entityType,
          entity_id: parsed.data.entityId,
          fields: TRANSLATABLE_FIELDS[entityType],
          master: resolved.master, // source/default-language values
          translations: byLocale,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PUT /admin/translations — upsert one locale's values for an entity
  // ---------------------------------------------------------------------------
  app.put(
    '/api/2026-05-20/admin/translations',
    { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = TranslationBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { entityType, locale, fields } = parsed.data;

      const allowed = new Set(TRANSLATABLE_FIELDS[entityType]);
      const resolved = await resolveEntity(db, tenantId, entityType, parsed.data.entityId);
      if (!resolved) return notFound(reply, 'ENTITY_NOT_FOUND');

      for (const [field, value] of Object.entries(fields)) {
        if (!allowed.has(field)) continue;
        if (value.trim() === '') {
          // empty → remove the override (fall back to master)
          await db
            .delete(schema.translations)
            .where(
              and(
                eq(schema.translations.tenantId, tenantId),
                eq(schema.translations.entityType, entityType),
                eq(schema.translations.entityId, resolved.id),
                eq(schema.translations.field, field),
                eq(schema.translations.locale, locale),
              ),
            );
          continue;
        }
        await db
          .insert(schema.translations)
          .values({ tenantId, entityType, entityId: resolved.id, field, locale, value })
          .onConflictDoUpdate({
            target: [
              schema.translations.tenantId,
              schema.translations.entityType,
              schema.translations.entityId,
              schema.translations.field,
              schema.translations.locale,
            ],
            set: { value, updatedAt: new Date() },
          });
      }

      return reply.send({ data: { ok: true } });
    },
  );
}

/** Resolve a pub_id to the row UUID + master field values. */
async function resolveEntity(
  db: AppDb,
  tenantId: string,
  entityType: EntityType,
  pubId: string,
): Promise<{ id: string; master: Record<string, string | null> } | null> {
  if (entityType === 'product') {
    const [p] = await db
      .select({ id: schema.products.id, title: schema.products.title, description_html: schema.products.descriptionHtml })
      .from(schema.products)
      .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.pubId, pubId)))
      .limit(1);
    if (!p) return null;
    return { id: p.id, master: { title: p.title, description_html: p.description_html } };
  }
  const [c] = await db
    .select({ id: schema.categories.id, name: schema.categories.name, description: schema.categories.description })
    .from(schema.categories)
    .where(and(eq(schema.categories.tenantId, tenantId), eq(schema.categories.pubId, pubId)))
    .limit(1);
  if (!c) return null;
  return { id: c.id, master: { name: c.name, description: c.description } };
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
