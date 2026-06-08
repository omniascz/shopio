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
import { createQrPlatbaProvider } from './qr-platba';
import { createGopayProvider, type GopayCredentials } from './gopay';
import { createComgateProvider, type ComgateCredentials } from './comgate';
import { createThepayProvider, type ThepayCredentials } from './thepay';
import { createPaysProvider, type PaysCredentials } from './pays';
import { createGpwebpayProvider, type GpwebpayCredentials } from './gpwebpay';
import { createPayuProvider, type PayuCredentials } from './payu';
import { createBarionProvider, type BarionCredentials } from './barion';
import { createBesteronProvider, type BesteronCredentials } from './besteron';
import { createTwistoProvider, type TwistoCredentials } from './twisto';
import { createPaypalProvider, type PaypalCredentials } from './paypal';
import { createStripeAbstractionProvider, type StripeProviderCredentials } from './stripe-provider';
import { createPrzelewy24Provider, type Przelewy24Credentials } from './przelewy24';
import { createTrustpayProvider, type TrustpayCredentials } from './trustpay';
import { createKlarnaProvider, type KlarnaCredentials } from './klarna';
import { createAlmaProvider, type AlmaCredentials } from './alma';
import { openCredentials } from '../secrets';

type PaymentProviderConfig = typeof schema.paymentProviderConfigs.$inferSelect;
type ProviderCode = (typeof schema.paymentProviderConfigs.$inferInsert)['providerCode'];

/**
 * Build the provider implementation for a config row. Returns null when the
 * provider code is not wired yet (future: stripe/gopay/comgate get added here).
 */
export function buildProvider(
  cfg: PaymentProviderConfig,
  appConfig: ShopioConfig,
): PaymentProvider | null {
  switch (cfg.providerCode) {
    case 'cod':
      return createCodProvider();
    case 'bank_transfer':
      return createBankTransferProvider();
    case 'qr_platba':
      return createQrPlatbaProvider();
    case 'gopay': {
      // Credentials are sealed at rest (per `30`) — decrypt before use.
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as GopayCredentials;
      return createGopayProvider(creds, cfg.isTestMode);
    }
    case 'comgate': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as ComgateCredentials;
      return createComgateProvider(creds, cfg.isTestMode);
    }
    case 'thepay': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as ThepayCredentials;
      return createThepayProvider(creds, cfg.isTestMode);
    }
    case 'pays': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as PaysCredentials;
      return createPaysProvider(creds, cfg.isTestMode);
    }
    case 'gpwebpay': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as GpwebpayCredentials;
      return createGpwebpayProvider(creds, cfg.isTestMode);
    }
    case 'payu': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as PayuCredentials;
      return createPayuProvider(creds, cfg.isTestMode);
    }
    case 'barion': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as BarionCredentials;
      return createBarionProvider(creds, cfg.isTestMode);
    }
    case 'besteron': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as BesteronCredentials;
      return createBesteronProvider(creds, cfg.isTestMode);
    }
    case 'twisto': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as TwistoCredentials;
      return createTwistoProvider(creds, cfg.isTestMode);
    }
    case 'paypal': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as PaypalCredentials;
      return createPaypalProvider(creds, cfg.isTestMode);
    }
    case 'stripe': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as StripeProviderCredentials;
      return createStripeAbstractionProvider(creds);
    }
    case 'przelewy24': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as Przelewy24Credentials;
      return createPrzelewy24Provider(creds, cfg.isTestMode);
    }
    case 'trustpay': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as TrustpayCredentials;
      return createTrustpayProvider(creds, cfg.isTestMode);
    }
    case 'klarna': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as KlarnaCredentials;
      return createKlarnaProvider(creds, cfg.isTestMode);
    }
    case 'alma': {
      const creds = openCredentials(appConfig, (cfg.credentials as Record<string, unknown>) ?? {}) as AlmaCredentials;
      return createAlmaProvider(creds, cfg.isTestMode);
    }
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
