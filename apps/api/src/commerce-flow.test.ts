/**
 * Commerce-flow e2e — the happy-path sale survey as an executable spec.
 *
 * Walks the full revenue loop against a freshly-created tenant (no dependency
 * on seed data, so it's idempotent and self-cleaning per run):
 *
 *   merchant setup (settings · shipping · payment · product · coupon)
 *     → buyer (cart · coupon · checkout)
 *       → order lifecycle (paid · invoice · fulfilled)
 *         → inventory decrement
 *           → returns saga (approve · receive · refund + restock)
 *             → inventory restored
 *               → customer account sees the order
 *                 → platform-admin gate rejects a non-allowlisted merchant
 *
 * Tests run top-to-bottom and share state captured in beforeAll/earlier steps.
 *
 * DB-backed: runs only with RUN_DB_TESTS=1 (plain `pnpm test` stays pure-unit).
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('commerce flow (e2e)', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (token: string) => ({ authorization: `Bearer ${token}` });

  // --- shared state across ordered steps -------------------------------------
  let merchantToken = '';
  let slug = '';
  let productSlug = '';
  let variantPubId = '';
  let initialStock = 0;
  let soldStock = 0;
  const COUPON = `SLEVA15-${ts}`;
  const customerEmail = `kupujici-${ts}@example.com`;
  const customerPassword = 'KupujiciHeslo2026!';
  let orderPubId = '';
  let orderNumber = '';
  let orderItemPubId = '';
  let returnPubId = '';

  // Accumulate Set-Cookie across the buyer's session (cart + customer cookies).
  const jar = new Map<string, string>();
  function stash(res: { headers: Record<string, unknown> }) {
    const raw = res.headers['set-cookie'];
    if (!raw) return;
    for (const line of Array.isArray(raw) ? raw : [String(raw)]) {
      const [pair] = String(line).split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  async function createMerchant(name: string) {
    const email = `cf-${name}-${ts}@example.com`;
    const password = 'ObchodniHeslo2026!XY';
    await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/signup',
      payload: { email, password },
    });
    const li = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/login',
      payload: { email, password },
    });
    let token = li.json().data.access_token as string;
    const tenantSlug = `cf-${name}-${ts}`;
    const ct = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/tenants',
      headers: H(token),
      payload: { displayName: `CF ${name} ${ts}`, slug: tenantSlug, countryCode: 'CZ' },
    });
    const tenantPubId = ct.json().data.tenant.id as string;
    const sw = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/switch-tenant',
      headers: H(token),
      payload: { tenantId: tenantPubId },
    });
    token = sw.json().data.access_token as string;
    return { token, slug: tenantSlug, email };
  }

  async function storefrontStock(): Promise<number> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/storefront/${slug}/products/${productSlug}`,
    });
    const v = res.json().data.variants[0];
    return v.stock ?? v.stock_on_hand ?? v.available ?? -1;
  }

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();
    const m = await createMerchant('shop');
    merchantToken = m.token;
    slug = m.slug;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  // ===========================================================================
  // MERCHANT SETUP
  // ===========================================================================
  it('merchant: dashboard + store settings are reachable', async () => {
    const dash = await app.inject({ method: 'GET', url: '/api/2026-05-20/admin/dashboard', headers: H(merchantToken) });
    expect(dash.statusCode).toBe(200);
    const settings = await app.inject({ method: 'GET', url: '/api/2026-05-20/admin/settings', headers: H(merchantToken) });
    expect(settings.statusCode).toBe(200);
  });

  it('merchant: tenant creation seeded a default shipping zone + rates', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/2026-05-20/admin/settings/shipping', headers: H(merchantToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.zones.length).toBeGreaterThanOrEqual(1);
    expect(res.json().data.rates.length).toBeGreaterThanOrEqual(1);
  });

  it('merchant: can enable an offline payment provider (cod)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/2026-05-20/admin/payment-providers/cod',
      headers: H(merchantToken),
      payload: { isEnabled: true, displayName: 'Dobírka', priority: 10, supportedCurrencies: ['CZK'] },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  it('merchant: can create a product with stock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/products',
      headers: H(merchantToken),
      payload: {
        title: 'E2E Keramický hrnek',
        slug: `e2e-mug-${ts}`,
        status: 'active',
        variants: [{ priceAmount: 30000, priceCurrency: 'CZK', stockOnHand: 20, sku: `E2E-${ts}` }],
      },
    });
    expect(res.statusCode).toBe(201);
    productSlug = `e2e-mug-${ts}`;
    variantPubId = res.json().data.variants[0].id as string;
    initialStock = await storefrontStock();
    expect(initialStock).toBe(20);
  });

  it('merchant: can create a 15% coupon', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/coupons',
      headers: H(merchantToken),
      payload: { code: COUPON, kind: 'percentage', value: 1500 },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  // ===========================================================================
  // BUYER
  // ===========================================================================
  it('buyer: registers a customer account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/auth/register`,
      payload: { email: customerEmail, password: customerPassword, fullName: 'Jan Kupující' },
    });
    expect([200, 201]).toContain(res.statusCode);
    stash(res);
  });

  it('buyer: adds 2 items to the cart', async () => {
    const cart = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart` });
    stash(cart);
    const add = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: cookieHeader() },
      payload: { variantId: variantPubId, quantity: 2 },
    });
    stash(add);
    expect([200, 201]).toContain(add.statusCode);
  });

  it('buyer: applies the coupon → cart shows a discount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/coupon`,
      headers: { cookie: cookieHeader() },
      payload: { code: COUPON },
    });
    stash(res);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.coupon_code).toBe(COUPON);
    expect(BigInt(res.json().data.discount.amount)).toBeGreaterThan(0n);
  });

  it('buyer: checks out → order is placed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/checkout`,
      headers: { cookie: cookieHeader() },
      payload: {
        customerEmail,
        customerName: 'Jan Kupující',
        customerPhone: '+420777000111',
        shippingAddress: { line1: 'Testovací 5', city: 'Praha 4', postalCode: '14000', countryCode: 'CZ' },
        paymentMethod: 'cod',
      },
    });
    stash(res);
    expect([200, 201]).toContain(res.statusCode);
    orderPubId = res.json().data.order.id as string;
    orderNumber = res.json().data.order.number as string;
    expect(orderNumber).toMatch(/^ORD-/);
  });

  // ===========================================================================
  // ORDER LIFECYCLE (admin)
  // ===========================================================================
  it('admin: order appears in the list with the discount applied', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/2026-05-20/admin/orders?limit=10', headers: H(merchantToken) });
    expect(list.statusCode).toBe(200);
    const found = list.json().data.orders.find((o: any) => (o.number ?? o.order_number) === orderNumber);
    expect(found).toBeTruthy();

    const det = await app.inject({ method: 'GET', url: `/api/2026-05-20/admin/orders/${orderPubId}`, headers: H(merchantToken) });
    expect(det.statusCode).toBe(200);
    orderItemPubId = det.json().data.items[0].id as string;
    expect(BigInt(det.json().data.totals.discount.amount)).toBeGreaterThan(0n);
  });

  it('admin: marking the order paid issues an invoice', async () => {
    const pay = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/status`,
      headers: H(merchantToken),
      payload: { status: 'paid' },
    });
    expect(pay.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 400)); // invoice is issued async after payment
    const invs = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/invoices`,
      headers: H(merchantToken),
    });
    expect(invs.statusCode).toBe(200);
    expect(invs.json().data.invoices.length).toBeGreaterThanOrEqual(1);
    expect(invs.json().data.invoices[0].number).toMatch(/^INV-/);
  });

  it('admin: can transition the order to fulfilled', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/status`,
      headers: H(merchantToken),
      payload: { status: 'fulfilled' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('inventory: stock dropped after the sale', async () => {
    soldStock = await storefrontStock();
    expect(soldStock).toBeLessThan(initialStock);
  });

  // ===========================================================================
  // RETURNS / REFUNDS saga
  // ===========================================================================
  it('returns: create → approve → receive → refund (with restock)', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/returns`,
      headers: H(merchantToken),
      payload: { items: [{ orderItemId: orderItemPubId, quantity: 1 }], reasonCode: 'other' },
    });
    expect([200, 201]).toContain(create.statusCode);
    returnPubId = create.json().data.id as string;

    for (const step of ['approve', 'receive'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/2026-05-20/admin/returns/${returnPubId}/${step}`,
        headers: H(merchantToken),
      });
      expect([200, 201]).toContain(res.statusCode);
    }

    const refund = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/returns/${returnPubId}/refund`,
      headers: H(merchantToken),
      payload: { restock: true },
    });
    expect([200, 201]).toContain(refund.statusCode);
  });

  it('inventory: restock returned the unit to stock', async () => {
    const restocked = await storefrontStock();
    expect(restocked).toBeGreaterThan(soldStock);
  });

  // ===========================================================================
  // CUSTOMER ACCOUNT
  // ===========================================================================
  it('customer: login → order history includes the purchase', async () => {
    const login = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/auth/login`,
      payload: { email: customerEmail, password: customerPassword },
    });
    expect(login.statusCode).toBe(200);
    stash(login);
    const orders = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/storefront/${slug}/me/orders`,
      headers: { cookie: cookieHeader() },
    });
    expect(orders.statusCode).toBe(200);
    const list = orders.json().data.orders ?? orders.json().data;
    expect(list.some((o: any) => (o.number ?? o.order_number) === orderNumber)).toBe(true);
  });

  // ===========================================================================
  // PLATFORM-ADMIN GATE
  // ===========================================================================
  it('platform: a non-allowlisted merchant is rejected from /platform/stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/2026-05-20/platform/stats',
      headers: H(merchantToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
