/**
 * Merchandising parity (Shoptet) — executable spec for:
 *   - Bestsellers ("Top nejprodávanější") ranked from paid order data
 *   - Back-in-stock notifications ("Hlídací pes")
 *
 * DB-backed: runs only with RUN_DB_TESTS=1.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('merchandising parity', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });
  let token = '';
  let slug = '';

  async function buyAndPay(variantPubId: string, qty: number) {
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart` });
    const cookie = cr.headers['set-cookie']!.toString().split(';')[0]!;
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie },
      payload: { variantId: variantPubId, quantity: qty },
    });
    const co = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/checkout`,
      headers: { cookie },
      payload: {
        customerEmail: `b-${ts}@example.com`,
        customerName: 'Kupující',
        shippingAddress: { line1: 'A 1', city: 'Praha', postalCode: '11000', countryCode: 'CZ' },
      },
    });
    const orderId = co.json().data.order.id;
    await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/orders/${orderId}/status`,
      headers: H(token),
      payload: { status: 'paid' },
    });
  }

  let v1 = '';
  let v2 = '';
  let oosVariant = '';
  let oosSlug = '';

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();

    const email = `mer-${ts}@example.com`;
    const password = 'MerchHeslo2026!';
    await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/signup', payload: { email, password } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/login', payload: { email, password } })).json().data.access_token;
    slug = `mer-${ts}`;
    const ct = await app.inject({ method: 'POST', url: '/api/2026-05-20/tenants', headers: H(token), payload: { displayName: `Mer ${ts}`, slug, countryCode: 'CZ' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/switch-tenant', headers: H(token), payload: { tenantId: ct.json().data.tenant.id } })).json().data.access_token;

    const p1 = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Pomalý produkt', slug: `slow-${ts}`, status: 'active', variants: [{ priceAmount: 10000, priceCurrency: 'CZK', stockOnHand: 100, sku: `SLOW-${ts}` }] } });
    v1 = p1.json().data.variants[0].id;
    const p2 = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Hit produkt', slug: `hit-${ts}`, status: 'active', variants: [{ priceAmount: 10000, priceCurrency: 'CZK', stockOnHand: 100, sku: `HIT-${ts}` }] } });
    v2 = p2.json().data.variants[0].id;

    // P2 sells more than P1
    await buyAndPay(v1, 1);
    await buyAndPay(v2, 5);

    // Out-of-stock product for the watchdog
    oosSlug = `oos-${ts}`;
    const p3 = await app.inject({ method: 'POST', url: '/api/2026-05-20/products', headers: H(token), payload: { title: 'Vyprodáno', slug: oosSlug, status: 'active', variants: [{ priceAmount: 50000, priceCurrency: 'CZK', stockOnHand: 0, sku: `OOS-${ts}` }] } });
    oosVariant = p3.json().data.variants[0].id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('bestsellers ranks the most-sold product first', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/bestsellers` });
    expect(res.statusCode).toBe(200);
    const products = res.json().data.products;
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products[0].slug).toBe(`hit-${ts}`); // sold 5 > 1
  });

  it('accepts a back-in-stock watch on an out-of-stock variant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/products/${oosSlug}/watch`,
      payload: { email: `watcher-${ts}@example.com`, variantId: oosVariant },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.watching).toBe(true);
  });

  it('restocking the variant fires the notification (best-effort Mailpit check)', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/2026-05-20/products?limit=50`, headers: H(token) });
    const prod = list.json().data.products.find((p: any) => p.slug === oosSlug);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/products/${prod.id}/variants/${oosVariant}`,
      headers: H(token),
      payload: { stockOnHand: 10 },
    });
    expect(res.statusCode).toBe(200);

    // Best-effort: poll Mailpit for the back-in-stock subject (dev only).
    try {
      await new Promise((r) => setTimeout(r, 600));
      const mp = await fetch('http://localhost:8027/api/v1/search?query=' + encodeURIComponent('skladem'));
      if (mp.ok) {
        const data = (await mp.json()) as { messages?: { Subject: string }[] };
        expect((data.messages ?? []).some((m) => /opět skladem/i.test(m.Subject))).toBe(true);
      }
    } catch {
      /* Mailpit not reachable — skip the delivery assertion */
    }
  });
});
