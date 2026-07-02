/**
 * Admin AI assists (per `33-ai-features.md` MVP).
 *   POST /admin/ai/product-description  — draft a product description
 *   POST /admin/ai/seo                  — suggest SEO title + meta description
 *
 * Stateless (no DB): pure Claude calls with per-request guardrails. Falls back
 * to a deterministic mock when ANTHROPIC_API_KEY is absent (see lib/ai).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema, withTenant, type TenantTx } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import {
  AiError,
  generateAltText,
  generateBulletPoints,
  generateProductDescription,
  generateSeo,
  isAiEnabled,
  suggestCategory,
  translateFields,
} from '../lib/ai';
import { AVAILABLE_LOCALES, TRANSLATABLE_FIELDS, type EntityType } from '../lib/translations';
import { getRlsDb } from '../db';
import type { ShopioConfig } from '../config';
import type { AppDb } from '../db';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const MAX_INPUT = 8000;

const attributes = z.record(z.string().max(80), z.string().max(400)).optional();

const ProductDescBody = z.object({
  title: z.string().min(1).max(255),
  attributes,
  tone: z.enum(['neutral', 'playful', 'premium', 'technical', 'minimal']).optional(),
  lengthWords: z.number().int().min(40).max(300).optional(),
  keywords: z.array(z.string().max(60)).max(15).optional(),
  locale: z.string().min(2).max(10).optional(),
});

const SeoBody = z.object({
  title: z.string().min(1).max(255),
  descriptionHtml: z.string().max(50000).optional(),
  attributes,
  keywords: z.array(z.string().max(60)).max(15).optional(),
  locale: z.string().min(2).max(10).optional(),
});

const TranslateBody = z.object({
  entityType: z.enum(['product', 'category']),
  entityId: z.string().min(1), // pub_id
  targetLocale: z.string().min(2).max(10),
  persist: z.boolean().optional(),
});

const CategorizeBody = z.object({
  title: z.string().min(1).max(255),
  attributes,
});

const BulletsBody = z.object({
  title: z.string().min(1).max(255),
  attributes,
  keywords: z.array(z.string().max(60)).max(15).optional(),
  count: z.number().int().min(3).max(7).optional(),
  locale: z.string().min(2).max(10).optional(),
});

const AltTextBody = z.object({
  title: z.string().min(1).max(255),
  attributes,
  locale: z.string().min(2).max(10).optional(),
});

export async function registerAiAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { config } = opts;
  const rlsDb = getRlsDb(config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.PRODUCT_EDIT)] };

  app.post('/api/2026-05-20/admin/ai/product-description', guard, async (req, reply) => {
    if (!req.auth!.tenantId) return noTenant(reply);
    const parsed = ProductDescBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (oversized(i.title, i.attributes)) return tooLarge(reply);
    try {
      const out = await generateProductDescription(config, {
        title: i.title,
        ...(i.attributes && { attributes: i.attributes }),
        ...(i.tone && { tone: i.tone }),
        ...(i.lengthWords && { lengthWords: i.lengthWords }),
        ...(i.keywords && { keywords: i.keywords }),
        locale: i.locale ?? 'cs-CZ',
      });
      return reply.send({ data: out });
    } catch (err) {
      return aiErr(reply, err);
    }
  });

  app.post('/api/2026-05-20/admin/ai/seo', guard, async (req, reply) => {
    if (!req.auth!.tenantId) return noTenant(reply);
    const parsed = SeoBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (oversized(i.title, i.attributes)) return tooLarge(reply);
    try {
      const out = await generateSeo(config, {
        title: i.title,
        ...(i.descriptionHtml && { descriptionHtml: i.descriptionHtml }),
        ...(i.attributes && { attributes: i.attributes }),
        ...(i.keywords && { keywords: i.keywords }),
        locale: i.locale ?? 'cs-CZ',
      });
      return reply.send({ data: out });
    } catch (err) {
      return aiErr(reply, err);
    }
  });

  // POST /admin/ai/translate — translate an entity's master fields to a locale,
  // optionally persisting into the translations table (fills the i18n deferral).
  app.post('/api/2026-05-20/admin/ai/translate', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = TranslateBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (!AVAILABLE_LOCALES.some((l) => l.code === i.targetLocale)) {
      return reply.code(422).send({
        error: { code: 'UNSUPPORTED_LOCALE', message: `Locale ${i.targetLocale} is not supported` },
      });
    }

    const resolved = await withTenant(rlsDb, tenantId, async (tx) => {
      const master = await resolveMaster(tx, tenantId, i.entityType, i.entityId);
      if (!master) return null;
      const [t] = await tx
        .select({ defaultLocale: schema.tenants.defaultLocale })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      return { ...master, defaultLocale: t?.defaultLocale ?? 'cs-CZ' };
    });
    if (!resolved) return notFound(reply, 'ENTITY_NOT_FOUND');

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(resolved.master)) if (v) fields[k] = v;
    if (Object.keys(fields).length === 0) {
      return reply.send({ data: { translations: {}, persisted: false, model: 'mock', mock: !isAiEnabled(config) } });
    }

    try {
      const out = await translateFields(config, {
        fields,
        sourceLocale: resolved.defaultLocale,
        targetLocale: i.targetLocale,
      });
      let persisted = false;
      const allowed = new Set(TRANSLATABLE_FIELDS[i.entityType]);
      const toWrite = Object.entries(out.translations).filter(([f, v]) => allowed.has(f) && v.trim() !== '');
      if (i.persist && toWrite.length) {
        await withTenant(rlsDb, tenantId, async (tx) => {
          for (const [field, value] of toWrite) {
            await tx
              .insert(schema.translations)
              .values({ tenantId, entityType: i.entityType, entityId: resolved.id, field, locale: i.targetLocale, value })
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
        });
        persisted = true;
      }
      return reply.send({ data: { ...out, persisted } });
    } catch (err) {
      return aiErr(reply, err);
    }
  });

  // POST /admin/ai/categorize — pick the best-fitting category from the tenant's
  // active categories (reads the catalog, so the suggestion uses real ids).
  app.post('/api/2026-05-20/admin/ai/categorize', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = CategorizeBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (oversized(i.title, i.attributes)) return tooLarge(reply);

    const cats = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select({ id: schema.categories.pubId, name: schema.categories.name, path: schema.categories.path })
        .from(schema.categories)
        .where(and(eq(schema.categories.tenantId, tenantId), eq(schema.categories.status, 'active')))
        .limit(300),
    );
    try {
      const out = await suggestCategory(config, {
        title: i.title,
        ...(i.attributes && { attributes: i.attributes }),
        categories: cats.map((c) => ({ id: c.id, name: c.name, path: c.path })),
      });
      return reply.send({ data: out });
    } catch (err) {
      return aiErr(reply, err);
    }
  });

  // POST /admin/ai/bullet-points — Amazon-style key features.
  app.post('/api/2026-05-20/admin/ai/bullet-points', guard, async (req, reply) => {
    if (!req.auth!.tenantId) return noTenant(reply);
    const parsed = BulletsBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (oversized(i.title, i.attributes)) return tooLarge(reply);
    try {
      const out = await generateBulletPoints(config, {
        title: i.title,
        ...(i.attributes && { attributes: i.attributes }),
        ...(i.keywords && { keywords: i.keywords }),
        ...(i.count && { count: i.count }),
        locale: i.locale ?? 'cs-CZ',
      });
      return reply.send({ data: out });
    } catch (err) {
      return aiErr(reply, err);
    }
  });

  // POST /admin/ai/alt-text — accessible/SEO image alt text.
  app.post('/api/2026-05-20/admin/ai/alt-text', guard, async (req, reply) => {
    if (!req.auth!.tenantId) return noTenant(reply);
    const parsed = AltTextBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    if (oversized(i.title, i.attributes)) return tooLarge(reply);
    try {
      const out = await generateAltText(config, {
        title: i.title,
        ...(i.attributes && { attributes: i.attributes }),
        locale: i.locale ?? 'cs-CZ',
      });
      return reply.send({ data: out });
    } catch (err) {
      return aiErr(reply, err);
    }
  });
}

async function resolveMaster(
  db: TenantTx,
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

function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}

function oversized(title: string, attrs?: Record<string, string>): boolean {
  return title.length + JSON.stringify(attrs ?? {}).length > MAX_INPUT;
}
function tooLarge(reply: any) {
  return reply.code(400).send({ error: { code: 'INPUT_TOO_LARGE', message: 'Vstup je příliš velký' } });
}
function aiErr(reply: any, err: unknown) {
  if (err instanceof AiError) {
    return reply.code(err.httpStatus).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}
function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
