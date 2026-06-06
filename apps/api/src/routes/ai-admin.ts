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
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { AiError, generateProductDescription, generateSeo } from '../lib/ai';
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

export async function registerAiAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { config } = opts;
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
