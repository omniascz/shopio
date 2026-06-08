/**
 * Wholesale / B2B price levels (Shoptet "Velkoobchod") — executable spec:
 * a customer group applies a % goods discount for its members in the cart
 * preview and at checkout.
 *
 * DB-backed: runs only with RUN_DB_TESTS=1.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('wholesale price levels', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });
  let token = '';
  let slug = '';
  let variantPubId = '';
  const email = `wholesale-${ts}@example.com`;
  const pw = 'VelkoHeslo2026!';
  let custCookie = '';

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();

    const mEmail = `wadm-${ts}@example.com`;
    await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/signup', payload: { email: mEmail, password: 'AdmHeslo2026!' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/login', payload: { email: mEmail, password: 'AdmHeslo2026!' } })).json().data.access_token;
    slug = `wadm-${ts}`;
    const ct = await app.inject({ method: 'POST', url: '/api/2026-05-20/tenants', headers: H(token), payload: { displayName: `W ${ts}`, slug, countryCode: 'CZ' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/switch-tenant', headers: H(token), payload: { tenantId: ct.json().data.tenant.id } })).json().data.access_token;

    const cp = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/products',
      headers: H(token),
      payload: { title: 'Velkoobchodní zboží', slug: `wholesale-${ts}`, status: 'active', variants: [{ priceAmount: 100000, priceCurrency: 'CZK', stockOnHand: 100, sku: `WH-${ts}` }] },
    });
    variantPubId = cp.json().data.variants[0].id;

    // Customer registers + logs in
    await app.inject({ method: 'POST', url: `/api/2026-05-20/storefront/${slug}/auth/register`, payload: { email, password: pw, fullName: 'Velkoodběratel' } });
    const li = await app.inject({ method: 'POST', url: `/api/2026-05-20/storefront/${slug}/auth/login`, payload: { email, password: pw } });
    const sessionCookie = li.headers['set-cookie']!.toString().split(';')[0]!;
    // Carry BOTH the customer session and the cart session across requests.
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart`, headers: { cookie: sessionCookie } });
    const cartCookie = cr.headers['set-cookie']!.toString().split(';')[0]!;
    custCookie = `${sessionCookie}; ${cartCookie}`;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('admin creates a wholesale group and assigns the customer', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/customer-groups',
      headers: H(token),
      payload: { name: 'Velkoobchod', discountBps: 2000 }, // 20 %
    });
    expect(create.statusCode).toBe(201);
    const groupPubId = create.json().data.id;

    const assign = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/customer-groups/${groupPubId}/members`,
      headers: H(token),
      payload: { email },
    });
    expect(assign.statusCode).toBe(200);
    expect(assign.json().data.assigned).toBe(true);
  });

  it('cart preview shows the 20% wholesale discount for the logged-in member', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: custCookie },
      payload: { variantId: variantPubId, quantity: 2 },
    });
    const cart = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart`, headers: { cookie: custCookie } });
    expect(cart.statusCode).toBe(200);
    // 2 × 1000 Kč = 2000 Kč → 20 % = 400 Kč → 40000 minor units
    expect(cart.json().data.discount.amount).toBe('40000');
  });

  it('checkout charges the wholesale price', async () => {
    const co = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/checkout`,
      headers: { cookie: custCookie },
      payload: {
        customerEmail: email,
        customerName: 'Velkoodběratel',
        shippingAddress: { line1: 'Sklad 1', city: 'Praha', postalCode: '11000', countryCode: 'CZ' },
      },
    });
    expect([200, 201]).toContain(co.statusCode);
    const orderId = co.json().data.order.id;
    const det = await app.inject({ method: 'GET', url: `/api/2026-05-20/admin/orders/${orderId}`, headers: H(token) });
    expect(det.json().data.totals.discount.amount).toBe('40000');
  });

  it('an anonymous shopper gets no wholesale discount', async () => {
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart` });
    const anon = cr.headers['set-cookie']!.toString().split(';')[0]!;
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: anon },
      payload: { variantId: variantPubId, quantity: 2 },
    });
    const cart = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart`, headers: { cookie: anon } });
    expect(cart.json().data.discount.amount).toBe('0');
  });
});
