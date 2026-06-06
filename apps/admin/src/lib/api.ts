/**
 * Admin API client — Bearer JWT auth.
 * Token stored in memory + refresh cookie handled by browser.
 */

const API_BASE = import.meta.env.VITE_SHOPIO_API_URL ?? 'http://localhost:4040';
const API_VERSION = '2026-05-20';

export interface Money {
  amount: string;
  currency: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  persona: string | null;
  tenant_id: string | null;
}

export interface LoginResult {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AuthUser;
}

export interface AnalyticsData {
  period: string;
  currency: string;
  totals: { revenue: Money; orders: number; average_order_value: Money };
  revenue_series: { day: string; revenue: string; orders: number }[];
  top_products: { title: string; units: number; revenue: Money }[];
  refunds: { amount: Money; count: number };
  customers: { new: number; returning: number };
}

export interface DashboardData {
  today: { orders: number; revenue: Money };
  pending_payment: number;
  returns_action_needed: number;
  low_stock: {
    product_id: string;
    product_title: string;
    variant_title: string;
    sku: string | null;
    available: number;
  }[];
}

export interface OrderListItem {
  id: string;
  number: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  payment_status: string;
  total: Money;
  placed_at: string;
}

export interface OrderDetail {
  id: string;
  number: string;
  customer: {
    email: string;
    name: string | null;
    phone: string | null;
    locale: string | null;
  };
  shipping_address: Record<string, string>;
  billing_address: Record<string, string> | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  channel_kind: string;
  totals: {
    subtotal: Money;
    shipping: Money;
    tax: Money;
    discount: Money;
    total: Money;
  };
  customer_note: string | null;
  placed_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  items: {
    id: string;
    product_title: string;
    variant_title: string;
    sku: string | null;
    quantity: number;
    unit_price: Money;
    line_subtotal: Money;
    line_total: Money;
  }[];
}

export interface InvoiceSummary {
  id: string;
  kind: 'invoice' | 'credit_note';
  number: string;
  variable_symbol: string | null;
  issued_at: string;
  taxable_supply_date: string;
  currency: string;
  subtotal: Money;
  tax: Money;
  total: Money;
  is_void: boolean;
}

export interface ReturnDetail {
  id: string;
  number: string;
  status: string;
  reason_code: string;
  customer_note: string | null;
  staff_note: string | null;
  currency: string;
  requested_refund: Money;
  shipping_refund: Money;
  actual_refund: Money | null;
  refund_method: string | null;
  refund_reference: string | null;
  requested_at: string;
  refunded_at: string | null;
  items: {
    id: string;
    title: string;
    sku: string | null;
    quantity: number;
    line_gross: Money;
    line_tax: Money;
    restocked: boolean;
  }[];
}

export interface ReturnQueueItem {
  id: string;
  number: string;
  status: string;
  reason_code: string;
  customer_note: string | null;
  requested_refund: Money;
  actual_refund: Money | null;
  requested_at: string;
  order: {
    id: string;
    number: string;
    customer_email: string;
    customer_name: string | null;
  };
}

export interface ShipmentDetail {
  id: string;
  number: string;
  status: string;
  carrier_code: string;
  service_code: string;
  weight_grams: number;
  tracking_number: string | null;
  tracking_url: string | null;
  label_provider: string | null;
  has_label: boolean;
  pickup_point: { name?: string } | null;
  internal_note: string | null;
  created_at: string;
  handed_over_at: string | null;
  delivered_at: string | null;
  items: { id: string; title: string; sku: string | null; quantity: number }[];
}

export interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  kind: 'percentage' | 'fixed' | 'free_shipping';
  value: string;
  currency: string | null;
  max_discount_amount: string | null;
  min_purchase_amount: string;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  usage_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  base_price_amount: string | null;
  base_price_currency: string | null;
  vendor: string | null;
  brand_name: string | null;
  published_at: string | null;
}

export interface ProductVariantDetail {
  id: string;
  sku: string | null;
  barcode?: string | null;
  title: string;
  price_amount: string;
  price_currency: string;
  compare_at_amount: string | null;
  weight_grams: number | null;
  requires_shipping?: boolean;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number;
  allow_backorder: boolean;
  option_values?: Record<string, string>;
  position?: number;
}

export interface ImportReport {
  created: number;
  created_slugs: string[];
  skipped: { line: number; reason: string }[];
  errors: { line: number; message: string }[];
  total_rows: number;
}

export interface MediaItem {
  id: string;
  kind?: string;
  url: string;
  alt: string | null;
  position?: number;
  is_primary: boolean;
}

export interface CategoryItem {
  id: string;
  slug: string;
  name: string;
  depth?: number;
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description_html: string | null;
  status: string;
  base_price_amount: string | null;
  base_price_currency: string | null;
  vendor: string | null;
  brand_name: string | null;
  published_at: string | null;
  variants: ProductVariantDetail[];
  media: MediaItem[];
  category_ids: string[];
  attributes: { name: string; value: string }[];
}

export interface ShopSettings {
  slug: string;
  display_name: string;
  legal_entity_name: string | null;
  country_code: string;
  default_currency: string;
  registration_number: string | null;
  vat_id: string | null;
  invoicing: {
    address: { line1?: string; line2?: string; city?: string; postal_code?: string };
    bank_account_iban: string | null;
    bank_account_swift: string | null;
  };
  appearance: { theme: string; accent_color: string; logo_url: string | null };
}

export interface ShippingSettings {
  zones: { id: string; name: string; country_codes: string[]; is_active: boolean }[];
  rates: {
    id: string;
    zone_id: string;
    carrier_code: string;
    service_code: string;
    display_name: string;
    kind: string;
    amount: string | null;
    currency: string;
    free_above_amount: string | null;
    pickup_only: boolean;
    is_active: boolean;
  }[];
  providers: {
    carrier_code: string;
    display_name: string;
    is_enabled: boolean;
    has_widget_key: boolean;
    has_api_password: boolean;
    has_webhook_secret: boolean;
    webhook_url: string | null;
    sender_name: string | null;
  }[];
}

export function productBasePrice(p: ProductListItem): Money | null {
  if (!p.base_price_amount || !p.base_price_currency) return null;
  return { amount: p.base_price_amount, currency: p.base_price_currency };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_BASE}/api/${API_VERSION}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    const json = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      // Try refresh on 401 (single attempt)
      if (res.status === 401 && this.accessToken && path !== '/auth/refresh') {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return this.request<T>(path, init);
        }
      }
      throw new ApiError(
        json?.error?.message ?? `API ${res.status}`,
        res.status,
        json?.error?.code,
      );
    }
    return json?.data as T;
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/${API_VERSION}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const json = await res.json();
      this.accessToken = json?.data?.access_token ?? null;
      return Boolean(this.accessToken);
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  async login(email: string, password: string): Promise<LoginResult> {
    return this.request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async me(): Promise<{ user: AuthUser }> {
    // /me returns tenant_id beside the user object — flatten to match AuthUser
    const data = await this.request<{
      user: Omit<AuthUser, 'tenant_id' | 'persona'>;
      tenant_id: string | null;
    }>('/me');
    return { user: { ...data.user, persona: null, tenant_id: data.tenant_id } };
  }

  async signup(body: {
    email: string;
    password: string;
    fullName?: string;
  }): Promise<{ user: { id: string; email: string; status: string } }> {
    return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(body) });
  }

  // ---------------------------------------------------------------------------
  // Tenants (onboarding)
  // ---------------------------------------------------------------------------
  async myTenants(): Promise<{
    memberships: {
      persona: string;
      status: string;
      tenant: { id: string; slug: string; display_name: string; status: string };
    }[];
  }> {
    return this.request('/me/tenants');
  }

  async createTenant(body: {
    displayName: string;
    slug?: string;
    countryCode: string;
    defaultCurrency?: string;
  }): Promise<{ tenant: { id: string; slug: string; display_name: string } }> {
    return this.request('/tenants', { method: 'POST', body: JSON.stringify(body) });
  }

  async switchTenant(tenantId: string): Promise<{
    access_token: string;
    expires_in: number;
    tenant: { id: string; display_name: string };
    persona: string;
  }> {
    return this.request('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.accessToken = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  async getDashboard(): Promise<DashboardData> {
    return this.request('/admin/dashboard');
  }

  async getAnalytics(period: string): Promise<AnalyticsData> {
    return this.request(`/admin/analytics?period=${period}`);
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------
  async listOrders(
    params: {
      status?: string | undefined;
      paymentStatus?: string | undefined;
      q?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
      sort?: string | undefined;
    } = {},
  ): Promise<{ orders: OrderListItem[]; total: number; offset: number; limit: number }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const path = qs.toString() ? `/admin/orders?${qs}` : '/admin/orders';
    return this.request(path);
  }

  async getOrder(id: string): Promise<OrderDetail> {
    return this.request(`/admin/orders/${id}`);
  }

  async updateOrderStatus(
    id: string,
    body: { status?: string; paymentStatus?: string },
  ): Promise<OrderDetail> {
    return this.request(`/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------
  async listOrderInvoices(orderId: string): Promise<{ invoices: InvoiceSummary[] }> {
    return this.request(`/admin/orders/${orderId}/invoices`);
  }

  async issueInvoice(orderId: string): Promise<InvoiceSummary> {
    return this.request(`/admin/orders/${orderId}/invoices`, { method: 'POST' });
  }

  /** Download an authenticated binary (PDF/XML) and trigger a browser save. */
  async downloadInvoiceFile(invoiceId: string, format: 'pdf' | 'xml'): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(`${API_BASE}/api/${API_VERSION}/admin/invoices/${invoiceId}.${format}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${invoiceId}.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Returns
  // ---------------------------------------------------------------------------
  async listOrderReturns(orderId: string): Promise<{ returns: ReturnDetail[] }> {
    return this.request(`/admin/orders/${orderId}/returns`);
  }

  async createReturn(
    orderId: string,
    body: {
      items: { orderItemId: string; quantity: number }[];
      reasonCode?: string;
      staffNote?: string;
    },
  ): Promise<ReturnDetail> {
    return this.request(`/admin/orders/${orderId}/returns`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async transitionReturn(
    returnId: string,
    action: 'approve' | 'reject' | 'receive' | 'cancel',
    body?: { reason?: string },
  ): Promise<ReturnDetail> {
    return this.request(`/admin/returns/${returnId}/${action}`, {
      method: 'POST',
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  async listReturns(
    params: { status?: string | undefined; limit?: number; offset?: number } = {},
  ): Promise<{
    returns: ReturnQueueItem[];
    total: number;
    action_needed: number;
    offset: number;
    limit: number;
  }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    return this.request(qs.toString() ? `/admin/returns?${qs}` : '/admin/returns');
  }

  async refundReturn(
    returnId: string,
    body: { refundShipping: boolean; restock: boolean },
  ): Promise<ReturnDetail & { credit_note_number?: string | null }> {
    return this.request(`/admin/returns/${returnId}/refund`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---------------------------------------------------------------------------
  // Shipments
  // ---------------------------------------------------------------------------
  async listOrderShipments(orderId: string): Promise<{ shipments: ShipmentDetail[] }> {
    return this.request(`/admin/orders/${orderId}/shipments`);
  }

  async createShipment(
    orderId: string,
    body: { items: { orderItemId: string; quantity: number }[]; internalNote?: string },
  ): Promise<ShipmentDetail> {
    return this.request(`/admin/orders/${orderId}/shipments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async generateShipmentLabel(shipmentId: string): Promise<ShipmentDetail> {
    return this.request(`/admin/shipments/${shipmentId}/label`, { method: 'POST' });
  }

  async transitionShipment(
    shipmentId: string,
    action: 'handed-over' | 'delivered' | 'cancel',
  ): Promise<ShipmentDetail> {
    return this.request(`/admin/shipments/${shipmentId}/${action}`, { method: 'POST' });
  }

  /** Download the shipping label PDF. */
  async downloadShipmentLabel(shipmentId: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(
      `${API_BASE}/api/${API_VERSION}/admin/shipments/${shipmentId}/label.pdf`,
      { headers, credentials: 'include' },
    );
    if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${shipmentId}-label.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Coupons
  // ---------------------------------------------------------------------------
  async listCoupons(): Promise<{ coupons: CouponItem[] }> {
    return this.request('/admin/coupons');
  }

  async createCoupon(body: {
    code: string;
    kind: string;
    value?: string;
    currency?: string;
    description?: string;
    minPurchaseAmount?: string;
    maxDiscountAmount?: string;
    maxUsesTotal?: number | null;
    maxUsesPerCustomer?: number | null;
    endsAt?: string | null;
  }): Promise<CouponItem> {
    return this.request('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateCoupon(id: string, body: { isActive?: boolean }): Promise<CouponItem> {
    return this.request(`/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.request(`/admin/coupons/${id}`, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Products (admin)
  // ---------------------------------------------------------------------------
  async listProducts(
    params: {
      status?: string | undefined;
      q?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    } = {},
  ): Promise<{ products: ProductListItem[]; count: number; offset: number; limit: number }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const path = qs.toString() ? `/products?${qs}` : '/products';
    return this.request(path);
  }

  async getProduct(idOrSlug: string): Promise<ProductDetail> {
    return this.request(`/products/${idOrSlug}`);
  }

  async createProduct(body: {
    title: string;
    slug?: string;
    descriptionHtml?: string;
    basePriceAmount?: string;
    basePriceCurrency?: string;
    status?: string;
    vendor?: string;
    brandName?: string;
    variants: {
      title?: string;
      sku?: string;
      priceAmount: string;
      priceCurrency: string;
      stockOnHand?: number;
      weightGrams?: number;
    }[];
  }): Promise<ProductDetail> {
    return this.request('/products', { method: 'POST', body: JSON.stringify(body) });
  }

  async updateProduct(
    id: string,
    body: Partial<{
      title: string;
      slug: string;
      descriptionHtml: string;
      basePriceAmount: string;
      basePriceCurrency: string;
      status: string;
      vendor: string | null;
      brandName: string | null;
      categoryIds: string[];
      attributes: { name: string; value: string }[];
    }>,
  ): Promise<ProductDetail> {
    return this.request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    body: Partial<{
      title: string;
      sku: string | null;
      priceAmount: string;
      compareAtAmount: string | null;
      weightGrams: number | null;
      allowBackorder: boolean;
      stockOnHand: number;
      stockNote: string;
    }>,
  ): Promise<ProductVariantDetail> {
    return this.request(`/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async archiveProduct(id: string): Promise<void> {
    await this.request(`/products/${id}`, { method: 'DELETE' });
  }

  async addVariant(
    productId: string,
    body: {
      title: string;
      sku?: string;
      priceAmount: string;
      priceCurrency: string;
      stockOnHand?: number;
      weightGrams?: number;
      optionValues?: Record<string, string>;
    },
  ): Promise<ProductVariantDetail> {
    return this.request(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---------------------------------------------------------------------------
  // Media
  // ---------------------------------------------------------------------------
  async uploadProductMedia(productId: string, file: File): Promise<MediaItem> {
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(`${API_BASE}/api/${API_VERSION}/products/${productId}/media`, {
      method: 'POST',
      headers, // no content-type — browser sets the multipart boundary
      body: form,
      credentials: 'include',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(json?.error?.message ?? `Upload failed (${res.status})`, res.status, json?.error?.code);
    }
    return json.data as MediaItem;
  }

  async updateProductMedia(
    productId: string,
    mediaId: string,
    body: { alt?: string | null; isPrimary?: boolean; position?: number },
  ): Promise<MediaItem> {
    return this.request(`/products/${productId}/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteProductMedia(productId: string, mediaId: string): Promise<void> {
    await this.request(`/products/${productId}/media/${mediaId}`, { method: 'DELETE' });
  }

  async importProductsCsv(file: File): Promise<ImportReport> {
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(`${API_BASE}/api/${API_VERSION}/products/import`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(json?.error?.message ?? `Import failed (${res.status})`, res.status, json?.error?.code);
    }
    return json.data as ImportReport;
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------
  async listCategories(): Promise<{ categories: CategoryItem[]; count: number }> {
    return this.request('/categories');
  }

  async createCategory(body: { name: string; slug?: string }): Promise<CategoryItem> {
    return this.request('/categories', { method: 'POST', body: JSON.stringify(body) });
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async getSettings(): Promise<ShopSettings> {
    return this.request('/admin/settings');
  }

  async updateSettings(body: {
    displayName?: string;
    legalEntityName?: string | null;
    registrationNumber?: string | null;
    vatId?: string | null;
    invoicing?: {
      address?: { line1?: string; line2?: string; city?: string; postal_code?: string };
      bank_account_iban?: string;
      bank_account_swift?: string;
    };
  }): Promise<ShopSettings> {
    return this.request('/admin/settings', { method: 'PATCH', body: JSON.stringify(body) });
  }

  async updateAppearance(body: {
    theme?: string;
    accentColor?: string;
    logoUrl?: string | null;
  }): Promise<ShopSettings> {
    return this.request('/admin/settings/appearance', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async getShippingSettings(): Promise<ShippingSettings> {
    return this.request('/admin/settings/shipping');
  }

  async updateShippingRate(
    rateId: string,
    body: {
      displayName?: string;
      amount?: string;
      freeAboveAmount?: string | null;
      isActive?: boolean;
    },
  ): Promise<unknown> {
    return this.request(`/admin/settings/shipping/rates/${rateId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async updateShippingProvider(
    carrierCode: string,
    body: {
      isEnabled?: boolean;
      widgetApiKey?: string | null;
      apiPassword?: string | null;
      webhookSecret?: string | null;
      senderName?: string | null;
    },
  ): Promise<unknown> {
    return this.request(`/admin/settings/shipping/providers/${carrierCode}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient();

/** Format Money for display. */
export function formatMoney(money: Money | null | undefined, locale = 'cs-CZ'): string {
  if (!money) return '—';
  const amount = Number(money.amount) / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
