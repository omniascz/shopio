/**
 * Server-side API client for storefront. Per `26-themes-storefront.md` §4.6
 * — fetches against API gateway, no auth needed (public storefront API).
 */

const API_BASE = process.env.SHOPIO_API_URL ?? 'http://localhost:4040';
const API_VERSION = '2026-05-20';

export interface Money {
  amount: string;
  currency: string;
}

export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  default_locale: string;
  default_currency: string;
  country_code: string;
}

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  base_price: Money | null;
  vendor: string | null;
  brand_name: string | null;
  published_at: string | null;
  primary_image: { url: string; alt: string | null } | null;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  title: string;
  price: Money;
  compare_at: Money | null;
  stock_on_hand: number;
  in_stock: boolean;
  option_values: Record<string, string>;
  position: number;
}

export interface ProductMedia {
  id: string;
  kind: 'image' | 'video' | 'model_3d';
  url: string;
  alt: string | null;
  width_px: number | null;
  height_px: number | null;
  position: number;
  is_primary: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description_html: string | null;
  base_price: Money | null;
  compare_at: Money | null;
  vendor: string | null;
  brand_name: string | null;
  published_at: string | null;
  variants: ProductVariant[];
  media: ProductMedia[];
  categories: { slug: string; name: string; path: string }[];
  tenant: { slug: string; display_name: string; default_currency: string };
}

class StorefrontApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

async function shopioFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = `${API_BASE}/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    next: { revalidate: 60 }, // Cache 60s for catalog
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } | null = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new StorefrontApiError(
      body?.error?.message ?? `API ${res.status}`,
      res.status,
      body?.error?.code,
    );
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function getTenant(tenantSlug: string): Promise<Tenant | null> {
  const data = await shopioFetch<{ tenant: Tenant }>(`/storefront/${tenantSlug}`);
  return data?.tenant ?? null;
}

export async function getProducts(
  tenantSlug: string,
  options: { q?: string; categorySlug?: string; limit?: number; offset?: number } = {},
): Promise<{ products: ProductListItem[]; count: number; offset: number; limit: number }> {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.categorySlug) params.set('categorySlug', options.categorySlug);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  const qs = params.toString();
  const data = await shopioFetch<{
    products: ProductListItem[];
    count: number;
    offset: number;
    limit: number;
  }>(`/storefront/${tenantSlug}/products${qs ? '?' + qs : ''}`);
  return data ?? { products: [], count: 0, offset: 0, limit: options.limit ?? 20 };
}

export async function getProduct(
  tenantSlug: string,
  productSlug: string,
): Promise<ProductDetail | null> {
  return shopioFetch<ProductDetail>(`/storefront/${tenantSlug}/products/${productSlug}`);
}

export { StorefrontApiError };

/** Format Money for display per locale. */
export function formatMoney(money: Money | null | undefined, locale = 'cs-CZ'): string {
  if (!money) return '—';
  const amount = Number(money.amount) / 100; // minor → major units
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
