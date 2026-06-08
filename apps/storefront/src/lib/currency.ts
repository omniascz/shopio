/**
 * Storefront presentment currency (P1). Cookie-based like the locale: a
 * `shopio_currency` cookie (set by the currency switcher) selects the
 * presentment currency; the API converts prices via ČNB FX. Absent/unsupported
 * → the API falls back to the tenant base currency.
 */

import { cookies } from 'next/headers';

export const CURRENCY_COOKIE = 'shopio_currency';

/** Read the selected presentment currency from the cookie (server components). */
export async function getStorefrontCurrency(): Promise<string | undefined> {
  const store = await cookies();
  const v = store.get(CURRENCY_COOKIE)?.value;
  return v && /^[A-Z]{3}$/.test(v) ? v : undefined;
}
