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

export interface TenantAppearance {
  theme: 'minimal' | 'warm' | 'dark' | string;
  accent_color: string;
  secondary_color?: string;
  font?: 'sans' | 'serif' | 'mixed' | string;
  radius?: 'sharp' | 'soft' | 'round' | string;
  logo_url: string | null;
}

export interface StorefrontHero {
  enabled?: boolean;
  headline?: string;
  subheadline?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
  align?: 'left' | 'center';
}

export interface StorefrontHomepage {
  announcement?: { enabled?: boolean; text?: string; url?: string };
  hero?: StorefrontHero;
}

export interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  default_locale: string;
  enabled_locales?: string[];
  default_currency: string;
  /** Presentment currencies the shop accepts (base first), per P1. */
  supported_currencies?: string[];
  country_code: string;
  appearance?: TenantAppearance;
  homepage?: StorefrontHomepage;
  analytics?: {
    ga4_measurement_id?: string | null;
    meta_pixel_id?: string | null;
  };
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
  rating?: RatingSummary;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  title: string;
  price: Money;
  compare_at: Money | null;
  /** EU Omnibus: lowest price of the last 30 days (only when on sale). */
  lowest_price_30d?: Money | null;
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
  attributes: { name: string; value: string }[];
  rating: RatingSummary;
  reviews: ProductReview[];
  tenant: { slug: string; display_name: string; default_currency: string };
}

export interface FacetFilter {
  name: string;
  values: { value: string; count: number }[];
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

export interface StorefrontCategory {
  id: string;
  slug: string;
  name: string;
  depth: number;
}

export async function getCategories(
  tenantSlug: string,
  locale?: string,
): Promise<StorefrontCategory[]> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  const data = await shopioFetch<{ categories: StorefrontCategory[] }>(
    `/storefront/${tenantSlug}/categories${qs}`,
  );
  return data?.categories ?? [];
}

export async function getProducts(
  tenantSlug: string,
  options: {
    q?: string;
    categorySlug?: string;
    limit?: number;
    offset?: number;
    facets?: Record<string, string[]>;
    locale?: string;
    currency?: string;
  } = {},
): Promise<{
  products: ProductListItem[];
  count: number;
  facets: FacetFilter[];
  offset: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.categorySlug) params.set('categorySlug', options.categorySlug);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  if (options.locale) params.set('locale', options.locale);
  if (options.currency) params.set('currency', options.currency);
  for (const [name, values] of Object.entries(options.facets ?? {})) {
    for (const v of values) params.append(`facet.${name}`, v);
  }
  const qs = params.toString();
  const data = await shopioFetch<{
    products: ProductListItem[];
    count: number;
    facets: FacetFilter[];
    offset: number;
    limit: number;
  }>(`/storefront/${tenantSlug}/products${qs ? '?' + qs : ''}`);
  return data ?? { products: [], count: 0, facets: [], offset: 0, limit: options.limit ?? 20 };
}

export async function getProduct(
  tenantSlug: string,
  productSlug: string,
  locale?: string,
  currency?: string,
): Promise<ProductDetail | null> {
  const params = new URLSearchParams();
  if (locale) params.set('locale', locale);
  if (currency) params.set('currency', currency);
  const qs = params.toString();
  return shopioFetch<ProductDetail>(`/storefront/${tenantSlug}/products/${productSlug}${qs ? '?' + qs : ''}`);
}

// =============================================================================
// Recommendations + collections + newsletter (P2/P3)
// =============================================================================

export interface RecCard {
  id: string;
  slug: string;
  title: string;
  base_price: Money | null;
  primary_image: { url: string; alt: string | null } | null;
}

export async function getRecommendations(
  tenantSlug: string,
  productSlug: string,
): Promise<{ frequently_bought_together: RecCard[]; related: RecCard[] }> {
  const data = await shopioFetch<{ frequently_bought_together: RecCard[]; related: RecCard[] }>(
    `/storefront/${tenantSlug}/products/${productSlug}/recommendations`,
  );
  return data ?? { frequently_bought_together: [], related: [] };
}

export interface CollectionLink {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export async function getCollections(tenantSlug: string): Promise<CollectionLink[]> {
  const data = await shopioFetch<{ collections: CollectionLink[] }>(`/storefront/${tenantSlug}/collections`);
  return data?.collections ?? [];
}

export async function getCollection(
  tenantSlug: string,
  slug: string,
  currency?: string,
): Promise<{ name: string; description: string | null; currency: string; products: RecCard[] } | null> {
  const qs = currency ? `?currency=${encodeURIComponent(currency)}` : '';
  return shopioFetch(`/storefront/${tenantSlug}/collections/${slug}${qs}`);
}

// =============================================================================
// CMS content (per `32`)
// =============================================================================

export interface CmsPageLink {
  slug: string;
  title: string;
}
export interface CmsPage {
  slug: string;
  title: string;
  body_html: string;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
}
export interface CmsBlogListItem {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}
export interface CmsBlogPost extends CmsBlogListItem {
  body_html: string;
  seo_title: string | null;
  seo_description: string | null;
}

export async function getPages(tenantSlug: string): Promise<CmsPageLink[]> {
  const data = await shopioFetch<{ pages: CmsPageLink[] }>(`/storefront/${tenantSlug}/pages`);
  return data?.pages ?? [];
}

export async function getPage(tenantSlug: string, slug: string): Promise<CmsPage | null> {
  return shopioFetch<CmsPage>(`/storefront/${tenantSlug}/pages/${slug}`);
}

export async function getBlogPosts(tenantSlug: string): Promise<CmsBlogListItem[]> {
  const data = await shopioFetch<{ posts: CmsBlogListItem[] }>(`/storefront/${tenantSlug}/blog`);
  return data?.posts ?? [];
}

export async function getBlogPost(tenantSlug: string, slug: string): Promise<CmsBlogPost | null> {
  return shopioFetch<CmsBlogPost>(`/storefront/${tenantSlug}/blog/${slug}`);
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
  /** Applied coupon code + its goods discount (per `10`). */
  coupon_code: string | null;
  coupon_kind: 'percentage' | 'fixed' | 'free_shipping' | null;
  discount: Money;
  total: Money;
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

export interface ShippingOption {
  rate_id: string;
  carrier_code: string;
  service_code: string;
  display_name: string;
  description: string | null;
  amount: string;
  currency: string;
  free: boolean;
  requires_pickup_point: boolean;
  supports_cod: boolean;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export interface ShippingRatesResponse {
  country: string;
  options: ShippingOption[];
  pickup_widget: { provider: string; api_key: string } | null;
}

export interface PickupPoint {
  external_id: string;
  name: string;
  street: string | null;
  city: string;
  postal_code: string;
  country_code: string;
}

export interface CheckoutInput {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: ShippingAddress;
  customerNote?: string;
  shippingRateId?: string;
  /** Payment method: 'invoice' (B2B NET terms) or a provider code (cod,
   * bank_transfer, gopay, …) chosen at checkout; omitted = highest priority. */
  paymentMethod?: string;
  purchaseOrderNumber?: string;
  pickupPoint?: {
    carrierCode: string;
    externalId: string;
    name?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
  };
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
    due_at?: string | null;
    payment_terms_days?: number | null;
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
  shipping_method: { display_name: string; carrier_code: string; service_code: string } | null;
  pickup_point: PickupPoint | null;
  placed_at: string;
  items: {
    id: string;
    variant_id: string;
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

/** Newsletter opt-in (client-side, public). */
export async function subscribeNewsletter(tenantSlug: string, email: string): Promise<boolean> {
  const res = await fetch(
    `${STOREFRONT_API_BASE}/api/${API_VERSION}/storefront/${tenantSlug}/newsletter/subscribe`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) },
  );
  return res.ok;
}

export interface OrderTrackingShipment {
  number: string;
  carrier: string;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  handed_over_at: string | null;
  delivered_at: string | null;
  events: { status: string; description: string | null; occurred_at: string }[];
}

/** Shipments + tracking timeline for an order (empty until fulfillment starts). */
export async function getOrderTracking(
  tenantSlug: string,
  orderNumber: string,
  email: string,
): Promise<OrderTrackingShipment[]> {
  try {
    const res = await fetch(
      `${STOREFRONT_API_BASE}/api/${API_VERSION}/storefront/${tenantSlug}/orders/${orderNumber}/tracking?email=${encodeURIComponent(email)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.shipments ?? [];
  } catch {
    return [];
  }
}

// =============================================================================
// Customer accounts (cookie session, client-side)
// =============================================================================

export interface CustomerProfile {
  id: string;
  email: string;
  email_verified?: boolean;
  full_name: string | null;
  phone: string | null;
  default_address: {
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
  } | null;
}

export interface CustomerOrder {
  number: string;
  status: string;
  payment_status: string;
  total: Money;
  placed_at: string;
  detail_url: string;
}

export interface CustomerCompany {
  id: string;
  name: string;
  registration_number: string | null;
  vat_id: string | null;
  billing_address: {
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
  } | null;
  net_terms_enabled: boolean;
  net_terms_days: number;
}

async function customerFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${STOREFRONT_API_BASE}/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message ?? `API ${res.status}`;
    throw new Error(message);
  }
  return (json?.data ?? null) as T | null;
}

export async function customerMe(tenantSlug: string): Promise<CustomerProfile | null> {
  try {
    const data = await customerFetch<{ customer: CustomerProfile }>(
      `/storefront/${tenantSlug}/me`,
    );
    return data?.customer ?? null;
  } catch {
    return null;
  }
}

export async function customerRegister(
  tenantSlug: string,
  body: { email: string; password: string; fullName?: string },
): Promise<CustomerProfile> {
  const data = await customerFetch<{ customer: CustomerProfile }>(
    `/storefront/${tenantSlug}/auth/register`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data!.customer;
}

export async function customerLogin(
  tenantSlug: string,
  body: { email: string; password: string },
): Promise<CustomerProfile> {
  const data = await customerFetch<{ customer: CustomerProfile }>(
    `/storefront/${tenantSlug}/auth/login`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data!.customer;
}

export async function customerLogout(tenantSlug: string): Promise<void> {
  await customerFetch(`/storefront/${tenantSlug}/auth/logout`, { method: 'POST' }).catch(() => {});
}

// Subscriptions (per `24`) -------------------------------------------------------
export interface SubscriptionInfo {
  id: string;
  status: 'active' | 'paused' | 'cancelled';
  items: { variant_id: string; quantity: number }[];
  interval_unit: 'week' | 'month';
  interval_count: number;
  payment_method: string;
  next_run_at: string;
  orders_created: number;
}

export async function customerSubscriptions(tenantSlug: string): Promise<SubscriptionInfo[]> {
  try {
    const d = await customerFetch<{ subscriptions: SubscriptionInfo[] }>(
      `/storefront/${tenantSlug}/me/subscriptions`,
    );
    return d?.subscriptions ?? [];
  } catch {
    return [];
  }
}

export async function customerCreateSubscription(
  tenantSlug: string,
  body: {
    items: { variantId: string; quantity: number }[];
    intervalUnit: 'week' | 'month';
    intervalCount?: number;
    paymentMethod?: string;
    shippingAddress?: ShippingAddress;
  },
): Promise<SubscriptionInfo | null> {
  return customerFetch(`/storefront/${tenantSlug}/me/subscriptions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function customerSubscriptionAction(
  tenantSlug: string,
  pubId: string,
  action: 'cancel' | 'pause' | 'resume',
): Promise<SubscriptionInfo | null> {
  return customerFetch(`/storefront/${tenantSlug}/me/subscriptions/${pubId}/${action}`, {
    method: 'POST',
  });
}

// Loyalty / store credit (per `19`) ----------------------------------------------
export interface LoyaltyInfo {
  balance: string;
  transactions: { kind: string; amount: string; currency: string; note: string | null; created_at: string }[];
}

export async function customerLoyalty(tenantSlug: string): Promise<LoyaltyInfo | null> {
  try {
    return await customerFetch<LoyaltyInfo>(`/storefront/${tenantSlug}/me/loyalty`);
  } catch {
    return null;
  }
}

// GDPR (per `30`) ----------------------------------------------------------------
/** Direct download URL for the customer's data export (browser sends the cookie). */
export function customerDataExportUrl(tenantSlug: string): string {
  return `${STOREFRONT_API_BASE}/api/${API_VERSION}/storefront/${tenantSlug}/me/data-export`;
}

/** Erase (anonymize) the logged-in customer's account. */
export async function customerDeleteAccount(
  tenantSlug: string,
): Promise<{ erased: boolean; invoices_retained: number } | null> {
  return customerFetch(`/storefront/${tenantSlug}/me/delete`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  });
}

// B2B company profile (per `21`) -------------------------------------------------
export async function customerCompany(tenantSlug: string): Promise<CustomerCompany | null> {
  try {
    const data = await customerFetch<{ company: CustomerCompany | null }>(
      `/storefront/${tenantSlug}/me/company`,
    );
    return data?.company ?? null;
  } catch {
    return null;
  }
}

export async function customerSaveCompany(
  tenantSlug: string,
  body: {
    name: string;
    registrationNumber?: string;
    vatId?: string;
    billingAddress?: {
      line1?: string;
      city?: string;
      postalCode?: string;
      countryCode?: string;
    };
  },
): Promise<CustomerCompany> {
  const data = await customerFetch<{ company: CustomerCompany }>(
    `/storefront/${tenantSlug}/me/company`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
  return data!.company;
}

export async function customerVerifyEmail(tenantSlug: string, token: string): Promise<string> {
  const data = await customerFetch<{ message: string }>(
    `/storefront/${tenantSlug}/auth/verify-email`,
    { method: 'POST', body: JSON.stringify({ token }) },
  );
  return data?.message ?? 'E-mail byl ověřen.';
}

export async function customerResendVerification(tenantSlug: string): Promise<string> {
  const data = await customerFetch<{ message: string }>(
    `/storefront/${tenantSlug}/auth/resend-verification`,
    { method: 'POST' },
  );
  return data?.message ?? 'Ověřovací e-mail jsme poslali znovu.';
}

export async function customerForgotPassword(tenantSlug: string, email: string): Promise<string> {
  const data = await customerFetch<{ message: string }>(
    `/storefront/${tenantSlug}/auth/forgot-password`,
    { method: 'POST', body: JSON.stringify({ email }) },
  );
  return data?.message ?? 'Pokud účet existuje, poslali jsme odkaz na obnovu hesla.';
}

export async function customerResetPassword(
  tenantSlug: string,
  body: { token: string; password: string },
): Promise<string> {
  const data = await customerFetch<{ message: string }>(
    `/storefront/${tenantSlug}/auth/reset-password`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data?.message ?? 'Heslo bylo změněno.';
}

export interface CustomerReturn {
  number: string;
  status: string;
  reason_code: string;
  requested_refund: Money;
  actual_refund: Money | null;
  requested_at: string;
  refunded_at: string | null;
  order_number?: string;
  items: { title: string; quantity: number; line_gross: Money }[];
}

export async function customerReturns(tenantSlug: string): Promise<CustomerReturn[]> {
  try {
    const data = await customerFetch<{ returns: CustomerReturn[] }>(
      `/storefront/${tenantSlug}/me/returns`,
    );
    return data?.returns ?? [];
  } catch {
    return [];
  }
}

export async function customerCreateReturn(
  tenantSlug: string,
  orderNumber: string,
  body: {
    items: { orderItemId: string; quantity: number }[];
    reasonCode?: string;
    note?: string;
  },
): Promise<CustomerReturn> {
  const data = await customerFetch<CustomerReturn>(
    `/storefront/${tenantSlug}/me/orders/${orderNumber}/returns`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data!;
}

export async function customerCreateReview(
  tenantSlug: string,
  productSlug: string,
  body: { rating: number; title?: string; body?: string },
): Promise<{ id: string; status: string; verified_purchase: boolean }> {
  const data = await customerFetch<{ id: string; status: string; verified_purchase: boolean }>(
    `/storefront/${tenantSlug}/products/${productSlug}/reviews`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data!;
}

export async function customerOrders(tenantSlug: string): Promise<CustomerOrder[]> {
  try {
    const data = await customerFetch<{ orders: CustomerOrder[] }>(
      `/storefront/${tenantSlug}/me/orders`,
    );
    return data?.orders ?? [];
  } catch {
    return [];
  }
}

/** Direct download URL for the order's tax invoice PDF (404 until issued). */
export function invoicePdfUrl(tenantSlug: string, orderNumber: string, email: string): string {
  return `${STOREFRONT_API_BASE}/api/${API_VERSION}/storefront/${tenantSlug}/orders/${orderNumber}/invoice.pdf?email=${encodeURIComponent(email)}`;
}

/** SPAYD QR-platba image for an order (bank transfer / QR platba). */
export function orderQrUrl(tenantSlug: string, orderNumber: string, email: string): string {
  return `${STOREFRONT_API_BASE}/api/${API_VERSION}/storefront/${tenantSlug}/orders/${orderNumber}/qr.png?email=${encodeURIComponent(email)}`;
}

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

export async function applyCoupon(tenantSlug: string, code: string): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart/coupon`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function removeCoupon(tenantSlug: string): Promise<Cart> {
  return cartFetch<Cart>(`/storefront/${tenantSlug}/cart/coupon`, { method: 'DELETE' });
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

export async function fetchShippingRates(
  tenantSlug: string,
  country?: string,
): Promise<ShippingRatesResponse> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  return cartFetch<ShippingRatesResponse>(`/storefront/${tenantSlug}/shipping/rates${qs}`);
}

export async function fetchPickupPoints(
  tenantSlug: string,
  opts: { carrier?: string; q?: string; country?: string } = {},
): Promise<PickupPoint[]> {
  const params = new URLSearchParams();
  if (opts.carrier) params.set('carrier', opts.carrier);
  if (opts.q) params.set('q', opts.q);
  if (opts.country) params.set('country', opts.country);
  const qs = params.toString();
  const data = await cartFetch<{ points: PickupPoint[] }>(
    `/storefront/${tenantSlug}/shipping/pickup-points${qs ? '?' + qs : ''}`,
  );
  return data.points;
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

export interface PaymentMethodOption {
  code: string;
  display_name: string;
  kind: 'offline' | 'redirect';
}

export async function getPaymentMethods(
  tenantSlug: string,
): Promise<PaymentMethodOption[]> {
  try {
    const res = await cartFetch<{ methods: PaymentMethodOption[] }>(
      `/storefront/${tenantSlug}/payment-methods`,
    );
    return res.methods;
  } catch {
    return [];
  }
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
