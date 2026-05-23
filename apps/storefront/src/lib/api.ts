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

// =============================================================================
// Cart / Checkout types
// =============================================================================

export interface CartItem {
  id: string;
  variant_id: string;
  product_id: string;
  product_slug: string;
  sku: string | null;
  title: string;
  quantity: number;
  unit_price: Money;
  line_total: Money;
  primary_image_url: string | null;
}

export interface TaxBreakdownEntry {
  tax_class: string;
  rate_basis_points: number;
  base_amount: string;
  tax_amount: string;
}

export interface Cart {
  id: string;
  status: string;
  currency: string;
  item_count: number;
  subtotal: Money;
  /** Whether prices already include VAT (CZ B2C default). */
  tax_included: boolean;
  /** VAT contained in the subtotal (estimate at tenant's home country). */
  tax: Money;
  /** Subtotal net of VAT. */
  net_subtotal: Money;
  tax_breakdown: TaxBreakdownEntry[];
  items: CartItem[];
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  state?: string;
}

export interface CheckoutInput {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: ShippingAddress;
  customerNote?: string;
}

export interface OrderConfirmation {
  order: {
    id: string;
    number: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    total: Money;
    placed_at: string;
    customer_email: string;
    confirmation_url: string;
  };
  payment_url: string | null;
  next_step: string;
}

export interface OrderDetail {
  id: string;
  number: string;
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  status: string;
  payment_status: string;
  payment_method: string;
  totals: {
    subtotal: Money;
    shipping: Money;
    tax: Money;
    total: Money;
  };
  tax_included: boolean;
  tax_breakdown: TaxBreakdownEntry[];
  placed_at: string;
  items: {
    id: string;
    product_title: string;
    variant_title: string;
    sku: string | null;
    quantity: number;
    unit_price: Money;
    line_total: Money;
  }[];
}

// =============================================================================
// Cart / Checkout API (client-side, cookie-based)
// =============================================================================

/** Browser-side API base. Falls back to relative path so Next.js rewrites can proxy. */
export const STOREFRONT_API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SHOPIO_API_URL ?? 'http://localhost:4040')
    : API_BASE;

async function cartFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${STOREFRONT_API_BASE}/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new StorefrontApiError(
      json?.error?.message ?? `API ${res.status}`,
      res.status,
      json?.error?.code,
    );
  }
  return json.data as T;
}

export async function fetchCart(tenantSlug: string): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart`);
}

export async function addToCart(
  tenantSlug: string,
  variantId: string,
  quantity = 1,
): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart/items`, {
    method: 'POST',
    body: JSON.stringify({ variantId, quantity }),
  });
}

export async function updateCartItem(
  tenantSlug: string,
  itemId: string,
  quantity: number,
): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartItem(tenantSlug: string, itemId: string): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function checkout(
  tenantSlug: string,
  input: CheckoutInput,
): Promise<OrderConfirmation> {
  return cartFetch<OrderConfirmation>(`/storefront/${tenantSlug}/checkout`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getOrder(
  tenantSlug: string,
  orderNumber: string,
  email: string,
): Promise<OrderDetail | null> {
  try {
    return await cartFetch<OrderDetail>(
      `/storefront/${tenantSlug}/orders/${orderNumber}?email=${encodeURIComponent(email)}`,
    );
  } catch (err) {
    if (err instanceof StorefrontApiError && err.status === 404) return null;
    throw err;
  }
}

/** Format a VAT rate in basis points as a percent label, e.g. 2100 → "21 %". */
export function formatVatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} %`;
}

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
