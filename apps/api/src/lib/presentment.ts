/**
 * Presentment currency (P1 multi-currency, per Saleor channel direction).
 *
 * A tenant authors prices in its base currency (`tenant.defaultCurrency`) and
 * may enable additional *presentment* currencies (e.g. base CZK + EUR + PLN).
 * The storefront converts displayed prices via the ČNB FX rates (`lib/fx`).
 *
 * This module is the thin display layer: resolve the requested currency against
 * the allow-list, and convert money objects. Charging in a presentment currency
 * (cart/checkout) is a separate slice; here we only convert for display.
 */

import { convertMinor, type CnbRate } from './fx';

export interface PresentmentConfig {
  base: string;
  /** Additional currencies the merchant enabled (excluding base). */
  presentment: string[];
}

/** Read the tenant's currency config from settings (base from the tenant row). */
export function readCurrencyConfig(base: string, settings: unknown): PresentmentConfig {
  const s = (settings ?? {}) as { currencies?: { presentment?: unknown } };
  const list = Array.isArray(s.currencies?.presentment) ? s.currencies!.presentment : [];
  const presentment = list
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.toUpperCase())
    .filter((c) => c !== base.toUpperCase());
  return { base: base.toUpperCase(), presentment: [...new Set(presentment)] };
}

/** All currencies the shop can present in (base first). */
export function supportedCurrencies(cfg: PresentmentConfig): string[] {
  return [cfg.base, ...cfg.presentment];
}

/**
 * Resolve a requested currency to one the shop supports, else the base.
 * Returns the base when the request is empty/unknown/equal to base.
 */
export function resolvePresentmentCurrency(
  requested: string | undefined,
  cfg: PresentmentConfig,
): string {
  if (!requested) return cfg.base;
  const r = requested.toUpperCase();
  return supportedCurrencies(cfg).includes(r) ? r : cfg.base;
}

export interface Money {
  amount: string; // minor units as string
  currency: string;
}

/**
 * A converter bound to (base → target) with the rate map. When target === base
 * it's an identity pass-through. Returns null when a rate is missing so the
 * caller can fall back to the base price.
 */
export function makeConverter(base: string, target: string, rates: Map<string, CnbRate>) {
  const identity = target.toUpperCase() === base.toUpperCase();
  return (amountMinor: bigint): Money | null => {
    if (identity) return { amount: amountMinor.toString(), currency: base.toUpperCase() };
    const converted = convertMinor(amountMinor, base, target, rates);
    if (converted == null) return null;
    return { amount: converted.toString(), currency: target.toUpperCase() };
  };
}
