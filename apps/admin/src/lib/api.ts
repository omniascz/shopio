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
    return this.request('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.accessToken = null;
    }
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
