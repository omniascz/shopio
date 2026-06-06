/**
 * Translation resolution (per `23-i18n.md` MVP §4.1).
 *
 * Master text lives on the entity; this loads localized overrides for a
 * requested locale with a fallback chain: exact locale → language base. The
 * tenant default locale needs no lookup (the master IS the default language).
 */

import { and, eq, inArray } from 'drizzle-orm';
import { schema, type TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

export type EntityType = 'product' | 'category';

/** Locales a merchant can enable (BCP-47 + native label). */
export const AVAILABLE_LOCALES: { code: string; name: string }[] = [
  { code: 'cs-CZ', name: 'Čeština' },
  { code: 'sk-SK', name: 'Slovenčina' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'pl-PL', name: 'Polski' },
];

/** Translatable fields per entity (translation field → source label). */
export const TRANSLATABLE_FIELDS: Record<EntityType, string[]> = {
  product: ['title', 'description_html'],
  category: ['name', 'description'],
};

/** Language base of a BCP-47 tag — 'en-US' → 'en'. */
export function languageBase(locale: string): string {
  return locale.split('-')[0]!.toLowerCase();
}

/**
 * Resolve the locale to actually serve from a requested tag and the tenant's
 * enabled list: exact match, else same language, else the tenant default.
 */
export function resolveServeLocale(
  requested: string | undefined | null,
  enabled: string[],
  defaultLocale: string,
): string {
  if (!requested) return defaultLocale;
  if (enabled.includes(requested)) return requested;
  const base = languageBase(requested);
  const sameLang = enabled.find((l) => languageBase(l) === base);
  return sameLang ?? defaultLocale;
}

/**
 * Batch-load translated field values for many entities of one type.
 * Returns Map<entityId, Map<field, value>> with exact-locale winning over the
 * language-base fallback. Returns an empty map when `locale` is the tenant
 * default (no overrides needed) — caller then uses master text.
 */
export async function loadTranslations(
  db: AppDb | TenantTx,
  tenantId: string,
  entityType: EntityType,
  entityIds: string[],
  locale: string,
  defaultLocale: string,
): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  if (locale === defaultLocale || entityIds.length === 0) return out;

  const base = languageBase(locale);
  const candidates = base === locale ? [locale] : [locale, base];

  const rows = await db
    .select({
      entityId: schema.translations.entityId,
      field: schema.translations.field,
      locale: schema.translations.locale,
      value: schema.translations.value,
    })
    .from(schema.translations)
    .where(
      and(
        eq(schema.translations.tenantId, tenantId),
        eq(schema.translations.entityType, entityType),
        inArray(schema.translations.entityId, entityIds),
        inArray(schema.translations.locale, candidates),
      ),
    );

  // exact-locale rows win; base-language rows only fill gaps. Order-independent:
  // an exact value always overwrites; a base value is skipped once a value (exact
  // or earlier base) is present, and is overwritten if an exact arrives later.
  for (const r of rows) {
    let fields = out.get(r.entityId);
    if (!fields) {
      fields = new Map();
      out.set(r.entityId, fields);
    }
    if (r.locale === locale || !fields.has(r.field)) {
      fields.set(r.field, r.value);
    }
  }
  return out;
}

/** Apply an entity's translation overrides onto a plain object (mutating copy). */
export function applyOverrides<T extends Record<string, unknown>>(
  obj: T,
  overrides: Map<string, string> | undefined,
  fieldKeys: Record<string, keyof T>,
): T {
  if (!overrides) return obj;
  for (const [field, key] of Object.entries(fieldKeys)) {
    const v = overrides.get(field);
    if (v != null && v !== '') obj[key] = v as T[keyof T];
  }
  return obj;
}
