/**
 * Admin payment providers — per-tenant gateway configuration (per `13 §7.1`,
 * FLOW-PAY-001). MVP scope: list configured providers merged with the catalog
 * of wired-up providers, and upsert a provider's config (enable, priority, test
 * mode, supported currencies, credentials).
 *
 *   GET  /admin/payment-providers            — catalog + tenant configs
 *   PUT  /admin/payment-providers/{code}     — upsert one provider's config
 *
 * Credentials are write-only in the API surface: PUT accepts them, GET never
 * returns them (only a `has_credentials` flag). Plaintext-at-rest for the MVP
 * (same posture as the Packeta keys); Vault migration is a later step.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { sealSecret, sealCredentials } from '../lib/secrets';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

type PaymentProviderConfig = typeof schema.paymentProviderConfigs.$inferSelect;
type ProviderCode = (typeof schema.paymentProviderConfigs.$inferInsert)['providerCode'];

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

/** Providers wired up in code (others in the spec are deferred). */
const PROVIDER_CATALOG: {
  code: string;
  displayName: string;
  kind: 'offline' | 'redirect';
  description: string;
  defaultMethodKinds: string[];
}[] = [
  {
    code: 'cod',
    displayName: 'Dobírka',
    kind: 'offline',
    description: 'Platba v hotovosti při převzetí. Bez brány.',
    defaultMethodKinds: ['cod'],
  },
  {
    code: 'bank_transfer',
    displayName: 'Bankovní převod',
    kind: 'offline',
    description: 'Převod na účet s variabilním symbolem. Ruční potvrzení platby.',
    defaultMethodKinds: ['bank_transfer'],
  },
  {
    code: 'gopay',
    displayName: 'GoPay',
    kind: 'redirect',
    description: 'CZ/SK platební brána — karty, bankovní tlačítka, Apple/Google Pay.',
    defaultMethodKinds: ['card', 'bank_transfer', 'apple_pay', 'google_pay'],
  },
  {
    code: 'stripe',
    displayName: 'Stripe',
    kind: 'redirect',
    description: 'Mezinárodní platební brána — karty, Apple/Google Pay.',
    defaultMethodKinds: ['card', 'apple_pay', 'google_pay'],
  },
];

const WIRED_CODES = new Set(['cod', 'bank_transfer', 'gopay']); // can be enabled today

/** Required credential keys per gateway (live mode). */
const REQUIRED_CREDENTIALS: Record<string, string[]> = {
  gopay: ['goId', 'clientId', 'clientSecret'],
};

const UpsertBody = z.object({
  isEnabled: z.boolean().optional(),
  isTestMode: z.boolean().optional(),
  displayName: z.string().min(1).max(120).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  supportedCurrencies: z.array(z.string().length(3)).max(20).optional(),
  supportedMethodKinds: z.array(z.string().max(40)).max(20).optional(),
  /** Write-only secrets/ids (merged into stored credentials). */
  credentials: z.record(z.string(), z.string()).optional(),
  webhookSecret: z.string().max(200).nullish(),
});

function serializeConfig(cfg: PaymentProviderConfig) {
  return {
    code: cfg.providerCode,
    is_enabled: cfg.isEnabled,
    is_test_mode: cfg.isTestMode,
    display_name: cfg.displayName,
    priority: cfg.priority,
    supported_currencies: cfg.supportedCurrencies,
    supported_method_kinds: cfg.supportedMethodKinds,
    has_credentials: Object.keys((cfg.credentials as Record<string, unknown>) ?? {}).length > 0,
    has_webhook_secret: Boolean(cfg.webhookSecret),
    updated_at: cfg.updatedAt,
  };
}

export async function registerPaymentAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);

  // ---------------------------------------------------------------------------
  // GET /admin/payment-providers — catalog merged with tenant configs
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/payment-providers',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.paymentProviderConfigs)
          .where(eq(schema.paymentProviderConfigs.tenantId, tenantId))
          .orderBy(asc(schema.paymentProviderConfigs.priority)),
      );
      const byCode = new Map<string, PaymentProviderConfig>(
        rows.map((r) => [r.providerCode, r]),
      );

      const providers = PROVIDER_CATALOG.map((p) => ({
        ...p,
        wired: WIRED_CODES.has(p.code),
        config: byCode.has(p.code) ? serializeConfig(byCode.get(p.code)!) : null,
      }));
      return reply.send({ data: { providers } });
    },
  );

  // ---------------------------------------------------------------------------
  // PUT /admin/payment-providers/{code} — upsert config
  // ---------------------------------------------------------------------------
  app.put<{ Params: { code: string } }>(
    '/api/2026-05-20/admin/payment-providers/:code',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const code = req.params.code;
      const catalogEntry = PROVIDER_CATALOG.find((p) => p.code === code);
      if (!catalogEntry) {
        return reply.code(404).send({
          error: { code: 'UNKNOWN_PROVIDER', message: `Neznámý provider '${code}'` },
        });
      }
      const parsed = UpsertBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      // Guard: only wired-up providers can be enabled (others lack an
      // implementation — enabling would fail every checkout).
      if (input.isEnabled && !WIRED_CODES.has(code)) {
        return reply.code(422).send({
          error: {
            code: 'PROVIDER_NOT_AVAILABLE',
            message: `Provider '${code}' zatím nelze aktivovat (chybí implementace).`,
          },
        });
      }

      const updated = await withTenant(rlsDb, tenantId, async (tx) => {
        const [existing] = await tx
          .select()
          .from(schema.paymentProviderConfigs)
          .where(
            and(
              eq(schema.paymentProviderConfigs.tenantId, tenantId),
              eq(schema.paymentProviderConfigs.providerCode, code as ProviderCode),
            ),
          )
          .limit(1);

        // Seal NEW credential values at rest (per `30`); existing values are
        // already sealed. Sealed strings stay truthy for the required-check.
        const mergedCredentials = {
          ...((existing?.credentials as Record<string, unknown>) ?? {}),
          ...sealCredentials(opts.config, input.credentials ?? {}),
        };

        // Live-mode gateways need their credentials before they can go live.
        // Test mode is allowed without them (mock fallback).
        const effectiveTestMode = input.isTestMode ?? existing?.isTestMode ?? true;
        const willEnable = input.isEnabled ?? existing?.isEnabled ?? false;
        const required = REQUIRED_CREDENTIALS[code] ?? [];
        if (willEnable && !effectiveTestMode && required.length > 0) {
          const missing = required.filter((k) => !mergedCredentials[k]);
          if (missing.length > 0) {
            return { __error: `Chybí přístupové údaje: ${missing.join(', ')}` } as const;
          }
        }

        if (existing) {
          const [row] = await tx
            .update(schema.paymentProviderConfigs)
            .set({
              ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
              ...(input.isTestMode !== undefined && { isTestMode: input.isTestMode }),
              ...(input.displayName !== undefined && { displayName: input.displayName }),
              ...(input.priority !== undefined && { priority: input.priority }),
              ...(input.supportedCurrencies !== undefined && {
                supportedCurrencies: input.supportedCurrencies,
              }),
              ...(input.supportedMethodKinds !== undefined && {
                supportedMethodKinds: input.supportedMethodKinds,
              }),
              ...(input.credentials !== undefined && { credentials: mergedCredentials }),
              ...(input.webhookSecret !== undefined && {
                webhookSecret: input.webhookSecret ? sealSecret(opts.config, input.webhookSecret) : null,
              }),
              updatedAt: new Date(),
            })
            .where(eq(schema.paymentProviderConfigs.id, existing.id))
            .returning();
          return row;
        }

        const [row] = await tx
          .insert(schema.paymentProviderConfigs)
          .values({
            tenantId,
            providerCode: code as ProviderCode,
            isEnabled: input.isEnabled ?? false,
            isTestMode: input.isTestMode ?? true,
            displayName: input.displayName ?? catalogEntry.displayName,
            priority: input.priority ?? 0,
            supportedCurrencies: input.supportedCurrencies ?? [],
            supportedMethodKinds:
              input.supportedMethodKinds ?? catalogEntry.defaultMethodKinds,
            credentials: mergedCredentials,
            webhookSecret: input.webhookSecret ? sealSecret(opts.config, input.webhookSecret) : null,
          })
          .returning();
        return row;
      });

      if (updated && '__error' in updated) {
        return reply.code(422).send({
          error: { code: 'MISSING_CREDENTIALS', message: updated.__error },
        });
      }
      return reply.send({ data: serializeConfig(updated!) });
    },
  );
}

function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
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
