/**
 * Catalog charges + ordering bounds (Shoptet parity) — executable spec for:
 *   - unit pricing (EU 98/6/ES "cena za měrnou jednotku")
 *   - recycling fee / PHE (disclosed, included in price)
 *   - returnable deposit
 *   - Min/Max orderable quantity (enforced in the cart)
 *
 * DB-backed: runs only with RUN_DB_TESTS=1.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('catalog charges + ordering bounds', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });
  let token = '';
  let slug = '';
  let productSlug = '';
  let variantPubId = '';
  let cartCookie = '';

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();

    const email = `cc-${ts}@example.com`;
    const password = 'ChargesHeslo2026!';
    await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/signup', payload: { email, password } });
    const li = await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/login', payload: { email, password } });
    token = li.json().data.access_token;
    slug = `cc-${ts}`;
    const ct = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/tenants',
      headers: H(token),
      payload: { displayName: `CC ${ts}`, slug, countryCode: 'CZ' },
    });
    const sw = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/switch-tenant',
      headers: H(token),
      payload: { tenantId: ct.json().data.tenant.id },
    });
    token = sw.json().data.access_token;

    productSlug = `kava-500g-${ts}`;
    const cp = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/products',
      headers: H(token),
      payload: {
        title: 'Zrnková káva 500 g',
        slug: productSlug,
        status: 'active',
        unitContentAmount: 500,
        unitContentUom: 'g',
        unitBaseAmount: 100,
        recyclingFeeAmount: 150, // 1.50 Kč PHE
        depositAmount: 300, // 3.00 Kč deposit
        variants: [
          {
            priceAmount: 24900, // 249 Kč
            priceCurrency: 'CZK',
            stockOnHand: 50,
            sku: `KAVA-${ts}`,
            minOrderQuantity: 2,
            maxOrderQuantity: 5,
          },
        ],
      },
    });
    expect(cp.statusCode).toBe(201);
    variantPubId = cp.json().data.variants[0].id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('storefront exposes unit price (Kč / 100 g)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/products/${productSlug}` });
    expect(res.statusCode).toBe(200);
    const up = res.json().data.unit_pricing;
    expect(up).toBeTruthy();
    expect(up.uom).toBe('g');
    expect(up.base_amount).toBe(100);
    // 249 Kč / 500 g * 100 g = 49.80 Kč/100 g → 4980 minor units
    expect(up.price_per_base.amount).toBe('4980');
  });

  it('storefront discloses recycling fee + deposit', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/products/${productSlug}` });
    expect(res.json().data.recycling_fee.amount).toBe('150');
    expect(res.json().data.deposit.amount).toBe('300');
  });

  it('storefront exposes per-variant min/max order quantity', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/products/${productSlug}` });
    const v = res.json().data.variants[0];
    expect(v.min_order_quantity).toBe(2);
    expect(v.max_order_quantity).toBe(5);
  });

  it('cart rejects below the minimum order quantity', async () => {
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/cart` });
    cartCookie = cr.headers['set-cookie']!.toString().split(';')[0]!;
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: cartCookie },
      payload: { variantId: variantPubId, quantity: 1 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('MIN_ORDER_QUANTITY');
  });

  it('cart accepts an order at the minimum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: cartCookie },
      payload: { variantId: variantPubId, quantity: 2 },
    });
    expect(res.statusCode).toBe(201);
  });

  it('cart rejects exceeding the maximum order quantity', async () => {
    // already 2 in cart; adding 4 → 6 > max 5
    const res = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/cart/items`,
      headers: { cookie: cartCookie },
      payload: { variantId: variantPubId, quantity: 4 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('MAX_ORDER_QUANTITY');
  });
});
