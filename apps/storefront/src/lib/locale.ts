/**
 * Storefront locale resolution (per `23-i18n.md` MVP).
 *
 * MVP keeps it cookie-based to avoid restructuring all routes under
 * `/[locale]`: a `shopio_locale` cookie (set by the locale switcher) selects
 * the content language; the API applies translations + fallback server-side.
 * When the cookie is absent the API falls back to the tenant default.
 */

import { cookies } from 'next/headers';

export const LOCALE_COOKIE = 'shopio_locale';

/** Read the selected locale from the cookie (server components). */
export async function getStorefrontLocale(): Promise<string | undefined> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return v && /^[a-z]{2}(-[A-Z]{2})?$/.test(v) ? v : undefined;
}

/** Short label for a locale code, e.g. 'en-US' → 'EN'. */
export function localeLabel(code: string): string {
  return code.split('-')[0]!.toUpperCase();
}
