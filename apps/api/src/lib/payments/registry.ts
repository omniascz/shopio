/**
 * Provider registry + checkout routing (per `13 §4.4`).
 *
 * `buildProvider` instantiates the right `PaymentProvider` from a per-tenant
 * `payment_provider_configs` row. `selectCheckoutProvider` picks the gateway to
 * use at checkout: enabled configs, filtered by currency, highest priority
 * first. Unknown/unconfigured provider codes return null (caller falls back to
 * the legacy env-Stripe / mock path for backward compatibility).
 */

import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import type { ShopioConfig } from '../../config';
import type { AppDb } from '../../db';
import type { PaymentProvider } from './types';
import { createCodProvider } from './cod';
import { createBankTransferProvider } from './bank-transfer';

type PaymentProviderConfig = typeof schema.paymentProviderConfigs.$inferSelect;
type ProviderCode = (typeof schema.paymentProviderConfigs.$inferInsert)['providerCode'];

/**
 * Build the provider implementation for a config row. Returns null when the
 * provider code is not wired yet (future: stripe/gopay/comgate get added here).
 */
export function buildProvider(
  cfg: PaymentProviderConfig,
  _appConfig: ShopioConfig,
): PaymentProvider | null {
  switch (cfg.providerCode) {
    case 'cod':
      return createCodProvider();
    case 'bank_transfer':
      return createBankTransferProvider();
    default:
      return null;
  }
}

export interface SelectedProvider {
  provider: PaymentProvider;
  config: PaymentProviderConfig;
}

/**
 * Pick the checkout provider for a tenant + currency. Returns the highest
 * priority enabled+wired provider whose supported currencies include the
 * order currency (empty list = any). When `preferredCode` is given, only a
 * provider with that exact code is returned (the customer's explicit choice).
 * Null when none match.
 */
export async function selectCheckoutProvider(
  rlsDb: AppDb,
  appConfig: ShopioConfig,
  tenantId: string,
  currency: string,
  preferredCode?: string,
): Promise<SelectedProvider | null> {
  const configs = await withTenant(rlsDb, tenantId, (tx) =>
    tx
      .select()
      .from(schema.paymentProviderConfigs)
      .where(
        and(
          eq(schema.paymentProviderConfigs.tenantId, tenantId),
          eq(schema.paymentProviderConfigs.isEnabled, true),
        ),
      )
      .orderBy(desc(schema.paymentProviderConfigs.priority)),
  );

  for (const cfg of configs) {
    if (preferredCode && cfg.providerCode !== preferredCode) continue;
    const currencies = cfg.supportedCurrencies ?? [];
    if (currencies.length > 0 && !currencies.includes(currency)) continue;
    const provider = buildProvider(cfg, appConfig);
    if (provider) return { provider, config: cfg };
  }
  return null;
}

/** Resolve a single enabled provider config by code (webhook + refund paths). */
export async function getProviderConfig(
  rlsDb: AppDb,
  tenantId: string,
  providerCode: string,
): Promise<PaymentProviderConfig | null> {
  const [cfg] = await withTenant(rlsDb, tenantId, (tx) =>
    tx
      .select()
      .from(schema.paymentProviderConfigs)
      .where(
        and(
          eq(schema.paymentProviderConfigs.tenantId, tenantId),
          eq(schema.paymentProviderConfigs.providerCode, providerCode as ProviderCode),
        ),
      )
      .limit(1),
  );
  return cfg ?? null;
}
