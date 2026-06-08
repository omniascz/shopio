/**
 * Gift with purchase (Shoptet "Dárek k objednávce") — executable spec:
 * a gift promotion adds one free unit of a chosen variant to the order when
 * the cart subtotal meets the threshold, without changing the order total.
 *
 * DB-backed: runs only with RUN_DB_TESTS=1.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('gift with purchase', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });
  let token = '';
  let slug = '';
  let mainVariant = '';
  let giftVariant = '';

  async function freshCartCookie() {
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart` });
    return cr.headers['set-cookie']!.toString().split(';')[0]!;
  }

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();

    const email = `gift-${ts}@example.com`;
    await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/signup', payload: { email, password: 'GiftHeslo2026!' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/login', payload: { email, password: 'GiftHeslo2026!' } })).json().data.access_token;
    slug = `gift-${ts}`;
    const ct = await app.inject({ method: 'POST', url: '/api/2026-05-20/tenants', headers: H(token), payload: { displayName: `Gift ${ts}`, slug, countryCode: 'CZ' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/switch-tenant', headers: H(token), payload: { tenantId: ct.json().data.tenant.id } })).json().data.access_token;

    const main = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Hlavní produkt', slug: `main-${ts}`, status: 'active', variants: [{ priceAmount: 100000, priceCurrency: 'CZK', stockOnHand: 100, sku: `MAIN-${ts}` }] } });
    mainVariant = main.json().data.variants[0].id;
    const gift = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Dárek', slug: `gift-prod-${ts}`, status: 'active', variants: [{ priceAmount: 19900, priceCurrency: 'CZK', stockOnHand: 50, sku: `GIFT-${ts}` }] } });
    giftVariant = gift.json().data.variants[0].id;

    // Gift promo: free gift when cart ≥ 500 Kč
    const promo = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/promotions',
      headers: H(token),
      payload: { name: 'Dárek nad 500 Kč', kind: 'gift', giftVariantId: giftVariant, minSubtotal: 50000 },
    });
    expect(promo.statusCode).toBe(201);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('adds the free gift line when the cart qualifies, with no cost', async () => {
    const cookie = await freshCartCookie();
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie },
      payload: { variantId: mainVariant, quantity: 1 }, // 1000 Kč ≥ 500
    });
    const co = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/checkout`,
      headers: { cookie },
      payload: { customerEmail: `b1-${ts}@example.com`, customerName: 'Kupující', shippingAddress: { line1: 'A 1', city: 'Praha', postalCode: '11000', countryCode: 'CZ' } },
    });
    expect([200, 201]).toContain(co.statusCode);
    const orderId = co.json().data.order.id;

    const det = await app.inject({ method: 'GET', url: `/api/2026-05-20/admin/orders/${orderId}`, headers: H(token) });
    const items = det.json().data.items;
    expect(items.length).toBe(2); // main + gift
    const giftLine = items.find((it: any) => it.sku === `GIFT-${ts}`);
    expect(giftLine).toBeTruthy();
    expect(giftLine.line_total?.amount ?? giftLine.line_total_amount ?? '0').toBe('0');
    // Order total = just the main product (gift is free)
    expect(det.json().data.totals.total.amount).toBe('100000');
  });

  it('does NOT add the gift when the cart is below the threshold', async () => {
    // a cheaper product under 500 Kč
    const cheap = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Levný', slug: `cheap-${ts}`, status: 'active', variants: [{ priceAmount: 30000, priceCurrency: 'CZK', stockOnHand: 100, sku: `CHEAP-${ts}` }] } });
    const cheapVariant = cheap.json().data.variants[0].id;
    const cookie = await freshCartCookie();
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie },
      payload: { variantId: cheapVariant, quantity: 1 }, // 300 Kč < 500
    });
    const co = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/checkout`,
      headers: { cookie },
      payload: { customerEmail: `b2-${ts}@example.com`, customerName: 'Kupující', shippingAddress: { line1: 'A 1', city: 'Praha', postalCode: '11000', countryCode: 'CZ' } },
    });
    const orderId = co.json().data.order.id;
    const det = await app.inject({ method: 'GET', url: `/api/2026-05-20/admin/orders/${orderId}`, headers: H(token) });
    expect(det.json().data.items.length).toBe(1); // no gift
  });
});
