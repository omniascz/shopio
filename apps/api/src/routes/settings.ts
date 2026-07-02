/**
 * Shop settings (admin) — per `27-admin-backoffice.md` settings surface.
 *
 *   GET   /admin/settings                  — tenant profile + invoicing + appearance
 *   PATCH /admin/settings                  — business identity (IČO/DIČ/adresa/banka)
 *   GET   /admin/settings/shipping         — zones, rates, provider configs
 *   PATCH /admin/settings/shipping/rates/{rateId}
 *   PATCH /admin/settings/shipping/providers/{carrierCode}
 *   PATCH /admin/settings/appearance       — storefront theme preset + colors + logo
 *
 * Gate: PERM-ADMIN-FULL (owner/admin). The invoicing identity feeds the
 * seller snapshot on every newly issued invoice (`15 §3.5`) — already-issued
 * invoices are immutable and keep their historical snapshot.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, ne, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { isSearchEnabled, reindexTenant } from '../lib/search';
import { sealCarrierOptions } from '../lib/carriers/secrets';
import { BlocksSchema } from '../lib/page-blocks';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const InvoicingSchema = z.object({
  address: z
    .object({
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(120).optional(),
      postal_code: z.string().max(20).optional(),
    })
    .optional(),
  bank_account_iban: z.string().max(42).optional(),
  bank_account_swift: z.string().max(16).optional(),
});

const PatchSettingsBody = z.object({
  displayName: z.string().min(1).max(255).optional(),
  legalEntityName: z.string().max(255).nullable().optional(),
  /** IČO */
  registrationNumber: z.string().max(20).nullable().optional(),
  /** DIČ / VAT ID */
  vatId: z.string().max(20).nullable().optional(),
  invoicing: InvoicingSchema.optional(),
});

const APPEARANCE_THEMES = ['minimal', 'warm', 'dark'] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const PatchAppearanceBody = z.object({
  theme: z.enum(APPEARANCE_THEMES).optional(),
  /** Accent color for buttons/links (hex). */
  accentColor: hexColor.optional(),
  /** Secondary brand color (badges, highlights) per `26`. */
  secondaryColor: hexColor.optional(),
  /** Type scale preset (per `26`). */
  font: z.enum(['sans', 'serif', 'mixed']).optional(),
  /** Corner rounding preset (per `26`). */
  radius: z.enum(['sharp', 'soft', 'round']).optional(),
  logoUrl: z.string().url().or(z.string().startsWith('/')).nullable().optional(),
});

/** Marketing/analytics integrations (per `29`) — client-side tracking IDs. */
const PatchIntegrationsBody = z.object({
  /** GA4 Measurement ID, e.g. "G-XXXXXXXXXX". */
  ga4MeasurementId: z.string().max(40).regex(/^G-[A-Z0-9]+$/i).or(z.literal('')).nullish(),
  /** Meta (Facebook) Pixel ID — numeric. */
  metaPixelId: z.string().max(40).regex(/^\d+$/).or(z.literal('')).nullish(),
});

/** Custom storefront domain (per `22`). */
const PatchDomainBody = z.object({
  /** Bare hostname, e.g. "obchod.example.cz". Empty string clears it. */
  customDomain: z
    .string()
    .max(253)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/i, 'Neplatná doména')
    .or(z.literal(''))
    .nullish(),
});

/** Loyalty / store-credit program config (per `19`). */
const PatchLoyaltyBody = z.object({
  enabled: z.boolean().optional(),
  /** Earn rate in basis points of the paid order total (e.g. 300 = 3 % back). */
  earnRateBps: z.number().int().min(0).max(5000).optional(),
});

/** Storefront homepage config (announcement bar + hero) per `26`. */
const PatchHomepageBody = z.object({
  announcement: z
    .object({
      enabled: z.boolean(),
      text: z.string().max(200),
      url: z.string().max(500).optional(),
    })
    .optional(),
  hero: z
    .object({
      enabled: z.boolean(),
      headline: z.string().max(120).optional(),
      subheadline: z.string().max(240).optional(),
      cta_text: z.string().max(40).optional(),
      cta_url: z.string().max(500).optional(),
      image_url: z.string().max(1000).optional(),
      align: z.enum(['left', 'center']).optional(),
    })
    .optional(),
});

const PatchRateBody = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  /** Flat / fallback amount (minor units as string). */
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(v))
    .optional(),
  /** Free-above threshold; null disables it (kind stays as-is). */
  freeAboveAmount: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null || v === '' ? null : BigInt(v)))
    .optional(),
  isActive: z.boolean().optional(),
  estimatedDaysMin: z.number().int().min(0).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).nullable().optional(),
});

const PatchProviderBody = z.object({
  isEnabled: z.boolean().optional(),
  /** Packeta widget API key (storefront map picker). MVP: stored in options
   * JSONB — moves to the secret store with the Vault wave. */
  widgetApiKey: z.string().max(120).nullable().optional(),
  /** Packeta REST API password (label generation). Same MVP caveat. */
  apiPassword: z.string().max(120).nullable().optional(),
  /** Inbound tracking-webhook secret (?secret= on the webhook URL). */
  webhookSecret: z.string().min(16).max(120).nullable().optional(),
  senderName: z.string().max(255).nullable().optional(),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);

  // ---------------------------------------------------------------------------
  // GET /admin/settings
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/settings',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const [tenant] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      return reply.send({ data: serializeSettings(tenant) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings — business identity
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchSettingsBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      if (input.invoicing) {
        const prior = (settings.invoicing ?? {}) as Record<string, unknown>;
        settings.invoicing = {
          ...prior,
          ...(input.invoicing.address && {
            address: {
              ...((prior.address as object) ?? {}),
              ...input.invoicing.address,
            },
          }),
          ...(input.invoicing.bank_account_iban !== undefined && {
            bank_account_iban: input.invoicing.bank_account_iban,
          }),
          ...(input.invoicing.bank_account_swift !== undefined && {
            bank_account_swift: input.invoicing.bank_account_swift,
          }),
        };
      }

      const [updated] = await db
        .update(schema.tenants)
        .set({
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.legalEntityName !== undefined && { legalEntityName: input.legalEntityName }),
          ...(input.registrationNumber !== undefined && {
            registrationNumber: input.registrationNumber,
          }),
          ...(input.vatId !== undefined && { vatId: input.vatId }),
          ...(input.invoicing && { settings }),
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      app.log.info({ tenantId, actor: req.auth!.userId }, 'settings.updated');
      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/appearance
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings/appearance',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchAppearanceBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      const prior = (settings.appearance ?? {}) as Record<string, unknown>;
      settings.appearance = {
        ...prior,
        ...(input.theme !== undefined && { theme: input.theme }),
        ...(input.accentColor !== undefined && { accent_color: input.accentColor }),
        ...(input.secondaryColor !== undefined && { secondary_color: input.secondaryColor }),
        ...(input.font !== undefined && { font: input.font }),
        ...(input.radius !== undefined && { radius: input.radius }),
        ...(input.logoUrl !== undefined && { logo_url: input.logoUrl }),
      };

      const [updated] = await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/integrations — GA4 + Meta Pixel IDs (per `29`)
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings/integrations',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchIntegrationsBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      const prior = (settings.integrations ?? {}) as Record<string, unknown>;
      settings.integrations = {
        ...prior,
        ...(input.ga4MeasurementId !== undefined && {
          ga4_measurement_id: input.ga4MeasurementId || null,
        }),
        ...(input.metaPixelId !== undefined && { meta_pixel_id: input.metaPixelId || null }),
      };

      const [updated] = await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/domain — custom storefront domain (per `22`)
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings/domain',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = PatchDomainBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const domain = (parsed.data.customDomain ?? '').toLowerCase().trim();

      // Enforce global uniqueness — a domain maps to exactly one shop.
      if (domain) {
        const [clash] = await db
          .select({ id: schema.tenants.id })
          .from(schema.tenants)
          .where(
            and(
              eq(dsql`lower(${schema.tenants.settings} ->> 'custom_domain')`, domain),
              ne(schema.tenants.id, tenantId),
            ),
          )
          .limit(1);
        if (clash) {
          return reply.code(409).send({
            error: { code: 'DOMAIN_TAKEN', message: 'Tato doména je již použita jiným e-shopem' },
          });
        }
      }

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>), custom_domain: domain || null };
      const [updated] = await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId))
        .returning();
      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/loyalty — store-credit program (per `19`)
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings/loyalty',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchLoyaltyBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      const prior = (settings.loyalty ?? {}) as Record<string, unknown>;
      settings.loyalty = {
        ...prior,
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.earnRateBps !== undefined && { earn_rate_bps: input.earnRateBps }),
      };

      const [updated] = await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/homepage — announcement bar + hero (per `26`)
  // ---------------------------------------------------------------------------
  app.patch(
    '/api/2026-05-20/admin/settings/homepage',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchHomepageBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      const prior = (settings.homepage ?? {}) as Record<string, unknown>;
      settings.homepage = {
        ...prior,
        ...(input.announcement !== undefined && { announcement: input.announcement }),
        ...(input.hero !== undefined && { hero: input.hero }),
      };

      const [updated] = await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      return reply.send({ data: serializeSettings(updated!) });
    },
  );

  // ---------------------------------------------------------------------------
  // GET/PUT /admin/settings/homepage-blocks — page-builder blocks for the home
  // page (per `32`). Stored in settings.homepage.blocks; validated on write.
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/settings/homepage-blocks',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');
      const s = (tenant.settings ?? {}) as { homepage?: { blocks?: unknown } };
      return reply.send({ data: { blocks: s.homepage?.blocks ?? [] } });
    },
  );

  app.put(
    '/api/2026-05-20/admin/settings/homepage-blocks',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = z.object({ blocks: BlocksSchema }).safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const [tenant] = await db
        .select({ settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');

      const settings = { ...(tenant.settings as Record<string, unknown>) };
      const prior = (settings.homepage ?? {}) as Record<string, unknown>;
      settings.homepage = { ...prior, blocks: parsed.data.blocks };

      await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId));
      return reply.send({ data: { blocks: parsed.data.blocks } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET/PUT /admin/settings/currencies — presentment currencies (P1).
  // Base = tenant.defaultCurrency; the merchant enables extras (EUR/PLN/…).
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/settings/currencies',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const [t] = await db
        .select({ base: schema.tenants.defaultCurrency, settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!t) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');
      const s = (t.settings ?? {}) as { currencies?: { presentment?: string[] } };
      return reply.send({ data: { base: t.base, presentment: s.currencies?.presentment ?? [] } });
    },
  );

  app.put(
    '/api/2026-05-20/admin/settings/currencies',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = z
        .object({ presentment: z.array(z.string().length(3)).max(10) })
        .safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const [t] = await db
        .select({ base: schema.tenants.defaultCurrency, settings: schema.tenants.settings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!t) return notFound(reply, 'TENANT_NOT_FOUND', 'Tenant not found');
      const base = t.base.toUpperCase();
      const presentment = [
        ...new Set(parsed.data.presentment.map((c) => c.toUpperCase()).filter((c) => c !== base)),
      ];
      const settings = { ...(t.settings as Record<string, unknown>) };
      settings.currencies = { ...(settings.currencies as object), presentment };
      await db
        .update(schema.tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(schema.tenants.id, tenantId));
      return reply.send({ data: { base, presentment } });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/settings/shipping — zones + rates + providers
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/settings/shipping',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const [tenantRow] = await db
        .select({ pubId: schema.tenants.pubId })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      const [zones, rates, providers] = await withTenant(rlsDb, tenantId, (tx) =>
        Promise.all([
          tx
            .select()
            .from(schema.shippingZones)
            .where(eq(schema.shippingZones.tenantId, tenantId))
            .orderBy(asc(schema.shippingZones.priority)),
          tx
            .select()
            .from(schema.shippingRates)
            .where(eq(schema.shippingRates.tenantId, tenantId))
            .orderBy(asc(schema.shippingRates.priority)),
          tx
            .select()
            .from(schema.shippingProviderConfigs)
            .where(eq(schema.shippingProviderConfigs.tenantId, tenantId)),
        ]),
      );

      return reply.send({
        data: {
          zones: zones.map((zn) => ({
            id: zn.id,
            name: zn.name,
            country_codes: zn.countryCodes,
            is_active: zn.isActive,
          })),
          rates: rates.map((r) => ({
            id: r.id,
            zone_id: r.shippingZoneId,
            carrier_code: r.carrierCode,
            service_code: r.serviceCode,
            display_name: r.displayName,
            description: r.description,
            kind: r.kind,
            amount: r.amount?.toString() ?? null,
            currency: r.currency,
            free_above_amount: r.freeAboveAmount?.toString() ?? null,
            pickup_only: r.pickupOnly,
            estimated_days_min: r.estimatedDaysMin,
            estimated_days_max: r.estimatedDaysMax,
            is_active: r.isActive,
          })),
          providers: providers.map((p) => {
            const o = p.options as {
              api_key?: string;
              api_password?: string;
              webhook_secret?: string;
            };
            return {
              carrier_code: p.carrierCode,
              display_name: p.displayName,
              is_enabled: p.isEnabled,
              is_test_mode: p.isTestMode,
              has_widget_key: Boolean(o.api_key),
              has_api_password: Boolean(o.api_password),
              has_webhook_secret: Boolean(o.webhook_secret),
              /** Configure this URL in the carrier's client portal (secret redacted). */
              webhook_url: o.webhook_secret
                ? `${config.SHOPIO_API_URL}/api/2026-05-20/webhooks/${p.carrierCode === 'zasilkovna' ? 'packeta' : p.carrierCode}/${tenantRow?.pubId ?? ''}?secret=•••`
                : null,
              sender_name:
                ((p.senderAddressSnapshot as { name?: string } | null) ?? {}).name ?? null,
            };
          }),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/shipping/rates/{rateId}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { rateId: string } }>(
    '/api/2026-05-20/admin/settings/shipping/rates/:rateId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchRateBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const updates = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ) as Partial<typeof schema.shippingRates.$inferInsert>;

      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.shippingRates)
          .set({ ...updates, updatedAt: new Date() })
          .where(
            and(
              eq(schema.shippingRates.tenantId, tenantId),
              eq(schema.shippingRates.id, req.params.rateId),
            ),
          )
          .returning(),
      );
      if (!updated) return notFound(reply, 'RATE_NOT_FOUND', 'Shipping rate not found');

      app.log.info({ tenantId, rateId: updated.id }, 'settings.shipping_rate_updated');
      return reply.send({
        data: {
          id: updated.id,
          display_name: updated.displayName,
          amount: updated.amount?.toString() ?? null,
          free_above_amount: updated.freeAboveAmount?.toString() ?? null,
          is_active: updated.isActive,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/settings/shipping/providers/{carrierCode}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { carrierCode: string } }>(
    '/api/2026-05-20/admin/settings/shipping/providers/:carrierCode',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = PatchProviderBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [provider] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.shippingProviderConfigs)
          .where(
            and(
              eq(schema.shippingProviderConfigs.tenantId, tenantId),
              eq(schema.shippingProviderConfigs.carrierCode, req.params.carrierCode),
            ),
          )
          .limit(1),
      );
      if (!provider) return notFound(reply, 'PROVIDER_NOT_FOUND', 'Carrier config not found');

      const options = { ...(provider.options as Record<string, unknown>) };
      if (input.widgetApiKey !== undefined) {
        if (input.widgetApiKey) options.api_key = input.widgetApiKey;
        else delete options.api_key;
      }
      if (input.apiPassword !== undefined) {
        if (input.apiPassword) options.api_password = input.apiPassword;
        else delete options.api_password;
      }
      if (input.webhookSecret !== undefined) {
        if (input.webhookSecret) options.webhook_secret = input.webhookSecret;
        else delete options.webhook_secret;
      }

      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.shippingProviderConfigs)
          .set({
            ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
            options: sealCarrierOptions(config, options),
            ...(input.senderName !== undefined && {
              senderAddressSnapshot: { name: input.senderName },
            }),
            updatedAt: new Date(),
          })
          .where(eq(schema.shippingProviderConfigs.id, provider.id))
          .returning(),
      );

      app.log.info({ tenantId, carrier: provider.carrierCode }, 'settings.provider_updated');
      return reply.send({
        data: {
          carrier_code: updated!.carrierCode,
          is_enabled: updated!.isEnabled,
          has_widget_key: Boolean((updated!.options as { api_key?: string }).api_key),
          has_api_password: Boolean(
            (updated!.options as { api_password?: string }).api_password,
          ),
        },
      });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

export function registerSearchAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): void {
  const { db, config } = opts;

  // POST /admin/search/reindex — backfill the tenant's products into Meilisearch
  app.post(
    '/api/2026-05-20/admin/search/reindex',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      if (!isSearchEnabled(config)) {
        return reply.code(503).send({
          error: { code: 'SEARCH_NOT_CONFIGURED', message: 'Meilisearch is not configured' },
        });
      }
      try {
        const count = await reindexTenant(config, db, tenantId, app.log);
        return reply.send({ data: { indexed: count } });
      } catch (err) {
        app.log.error({ err, tenantId }, 'search.reindex_failed');
        return reply.code(502).send({
          error: { code: 'SEARCH_ERROR', message: 'Reindex failed — is Meilisearch running?' },
        });
      }
    },
  );
}

function serializeSettings(tenant: typeof schema.tenants.$inferSelect) {
  const settings = (tenant.settings ?? {}) as {
    invoicing?: {
      address?: { line1?: string; line2?: string; city?: string; postal_code?: string };
      bank_account_iban?: string;
      bank_account_swift?: string;
    };
    appearance?: {
      theme?: string;
      accent_color?: string;
      secondary_color?: string;
      font?: string;
      radius?: string;
      logo_url?: string;
    };
    homepage?: {
      announcement?: { enabled?: boolean; text?: string; url?: string };
      hero?: Record<string, unknown>;
    };
    integrations?: { ga4_measurement_id?: string | null; meta_pixel_id?: string | null };
    loyalty?: { enabled?: boolean; earn_rate_bps?: number };
    custom_domain?: string | null;
  };
  return {
    slug: tenant.slug,
    display_name: tenant.displayName,
    legal_entity_name: tenant.legalEntityName,
    country_code: tenant.countryCode,
    default_currency: tenant.defaultCurrency,
    default_locale: tenant.defaultLocale,
    registration_number: tenant.registrationNumber,
    vat_id: tenant.vatId,
    price_includes_tax: tenant.priceIncludesTax,
    invoicing: {
      address: settings.invoicing?.address ?? {},
      bank_account_iban: settings.invoicing?.bank_account_iban ?? null,
      bank_account_swift: settings.invoicing?.bank_account_swift ?? null,
    },
    appearance: {
      theme: settings.appearance?.theme ?? 'minimal',
      accent_color: settings.appearance?.accent_color ?? '#111111',
      secondary_color: settings.appearance?.secondary_color ?? '#0066ff',
      font: settings.appearance?.font ?? 'sans',
      radius: settings.appearance?.radius ?? 'soft',
      logo_url: settings.appearance?.logo_url ?? null,
    },
    homepage: {
      announcement: {
        enabled: settings.homepage?.announcement?.enabled ?? false,
        text: settings.homepage?.announcement?.text ?? '',
        url: settings.homepage?.announcement?.url ?? '',
      },
      hero: (settings.homepage?.hero as Record<string, unknown>) ?? { enabled: false },
    },
    integrations: {
      ga4_measurement_id: settings.integrations?.ga4_measurement_id ?? null,
      meta_pixel_id: settings.integrations?.meta_pixel_id ?? null,
    },
    loyalty: {
      enabled: settings.loyalty?.enabled ?? false,
      earn_rate_bps: settings.loyalty?.earn_rate_bps ?? 0,
    },
    custom_domain: settings.custom_domain ?? null,
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

function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  });
}
