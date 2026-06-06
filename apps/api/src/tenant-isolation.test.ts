/**
 * Tenant-isolation regression suite — per `30-security.md` multi-tenancy.
 *
 * Builds two fresh tenants (A = attacker, B = victim with a full data set:
 * product, paid order, invoice, return, shipment), then tries to reach every
 * B resource with A's admin token. Every attempt must come back 404 (the
 * convention: foreign resources are indistinguishable from missing ones).
 *
 * This is the executable spec that RLS will later enforce at the DB layer —
 * any future endpoint that forgets the tenant filter turns this suite red.
 *
 * DB-backed: runs only with RUN_DB_TESTS=1 (dev: `pnpm test:isolation`;
 * plain `pnpm test` stays pure-unit for CI).
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('tenant isolation', () => {
  let app: FastifyInstance;
  let tokenA: string;
  // Victim resources (tenant B)
  let b: {
    slug: string;
    orderPubId: string;
    orderNumber: string;
    customerEmail: string;
    invoicePubId: string;
    returnPubId: string;
    shipmentPubId: string;
    productPubId: string;
    variantPubId: string;
    rateId: string;
  };

  const ts = Date.now();
  const H = (token: string) => ({ authorization: `Bearer ${token}` });

  async function createMerchant(name: string) {
    const email = `iso-${name}-${ts}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/signup',
      payload: { email, password: 'IzolacniHeslo2026!XY' },
    });
    const li = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/login',
      payload: { email, password: 'IzolacniHeslo2026!XY' },
    });
    let token = li.json().data.access_token as string;
    const ct = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/tenants',
      headers: H(token),
      payload: { displayName: `Iso ${name} ${ts}`, slug: `iso-${name}-${ts}`, countryCode: 'CZ' },
    });
    const tenantPubId = ct.json().data.tenant.id as string;
    const sw = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/switch-tenant',
      headers: H(token),
      payload: { tenantId: tenantPubId },
    });
    token = sw.json().data.access_token as string;
    return { token, slug: `iso-${name}-${ts}` };
  }

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();

    const merchantA = await createMerchant('a');
    const merchantB = await createMerchant('b');
    tokenA = merchantA.token;
    const tokenB = merchantB.token;
    const slugB = merchantB.slug;

    // ---- Build the victim data set in tenant B ----
    const cp = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/products',
      headers: H(tokenB),
      payload: {
        title: 'Tajný produkt B',
        slug: 'tajny-produkt-b',
        status: 'active',
        variants: [{ priceAmount: 50000, priceCurrency: 'CZK', stockOnHand: 10, sku: `ISO-B-${ts}` }],
      },
    });
    const productPubId = cp.json().data.id as string;
    const variantPubId = cp.json().data.variants[0].id as string;

    // Customer order via storefront checkout
    const customerEmail = `obet-${ts}@example.com`;
    const cr = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slugB}/cart` });
    const cookie = cr.headers['set-cookie']!.toString().split(';')[0]!;
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slugB}/cart/items`,
      headers: { cookie },
      payload: { variantId: variantPubId, quantity: 2 },
    });
    const co = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slugB}/checkout`,
      headers: { cookie },
      payload: {
        customerEmail,
        customerName: 'Oběť Izolace',
        shippingAddress: { line1: 'B 1', city: 'Praha', postalCode: '11000', countryCode: 'CZ' },
      },
    });
    const orderPubId = co.json().data.order.id as string;
    const orderNumber = co.json().data.order.number as string;

    // Pay (issues the invoice) + create return + shipment with label
    await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/status`,
      headers: H(tokenB),
      payload: { status: 'paid' },
    });
    await new Promise((r) => setTimeout(r, 300)); // async invoice issue
    const invs = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/invoices`,
      headers: H(tokenB),
    });
    const invoicePubId = invs.json().data.invoices[0].id as string;

    const det = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/orders/${orderPubId}`,
      headers: H(tokenB),
    });
    const orderItemPubId = det.json().data.items[0].id as string;

    const ret = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/returns`,
      headers: H(tokenB),
      payload: { items: [{ orderItemId: orderItemPubId, quantity: 1 }], reasonCode: 'other' },
    });
    const returnPubId = ret.json().data.id as string;

    const shp = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/orders/${orderPubId}/shipments`,
      headers: H(tokenB),
      payload: { items: [{ orderItemId: orderItemPubId, quantity: 1 }] },
    });
    const shipmentPubId = shp.json().data.id as string;
    await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/shipments/${shipmentPubId}/label`,
      headers: H(tokenB),
    });

    const shipSettings = await app.inject({
      method: 'GET',
      url: '/api/2026-05-20/admin/settings/shipping',
      headers: H(tokenB),
    });
    const rateId = shipSettings.json().data.rates[0].id as string;

    b = {
      slug: slugB,
      orderPubId,
      orderNumber,
      customerEmail,
      invoicePubId,
      returnPubId,
      shipmentPubId,
      productPubId,
      variantPubId,
      rateId,
    };
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  // ---- Admin surface: A's token vs. B's resources --------------------------

  it('A cannot read B order detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/orders/${b.orderPubId}`,
      headers: H(tokenA),
    });
    expect(res.statusCode).toBe(404);
  });

  it('A cannot transition B order status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/orders/${b.orderPubId}/status`,
      headers: H(tokenA),
      payload: { status: 'cancelled' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('A cannot list or issue B invoices, nor download the PDF/XML', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/orders/${b.orderPubId}/invoices`,
      headers: H(tokenA),
    });
    expect(list.statusCode).toBe(404);

    const issue = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/admin/orders/${b.orderPubId}/invoices`,
      headers: H(tokenA),
    });
    expect(issue.statusCode).toBe(404);

    for (const ext of ['pdf', 'xml'] as const) {
      const dl = await app.inject({
        method: 'GET',
        url: `/api/2026-05-20/admin/invoices/${b.invoicePubId}.${ext}`,
        headers: H(tokenA),
      });
      expect(dl.statusCode).toBe(404);
    }
  });

  it('A cannot touch B returns (transitions + refund)', async () => {
    for (const action of ['approve', 'reject', 'receive', 'cancel', 'refund'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/2026-05-20/admin/returns/${b.returnPubId}/${action}`,
        headers: H(tokenA),
        payload: {},
      });
      expect(res.statusCode, action).toBe(404);
    }
  });

  it('A cannot touch B shipments (label, transitions, label download)', async () => {
    for (const path of [
      `shipments/${b.shipmentPubId}/label`,
      `shipments/${b.shipmentPubId}/handed-over`,
      `shipments/${b.shipmentPubId}/delivered`,
      `shipments/${b.shipmentPubId}/cancel`,
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/2026-05-20/admin/${path}`,
        headers: H(tokenA),
      });
      expect(res.statusCode, path).toBe(404);
    }
    const label = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/admin/shipments/${b.shipmentPubId}/label.pdf`,
      headers: H(tokenA),
    });
    expect(label.statusCode).toBe(404);
  });

  it('A cannot read or edit B product / variant', async () => {
    const read = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/products/${b.productPubId}`,
      headers: H(tokenA),
    });
    expect(read.statusCode).toBe(404);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/products/${b.productPubId}`,
      headers: H(tokenA),
      payload: { title: 'Ukradeno' },
    });
    expect(patch.statusCode).toBe(404);

    const variant = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/products/${b.productPubId}/variants/${b.variantPubId}`,
      headers: H(tokenA),
      payload: { priceAmount: '1' },
    });
    expect(variant.statusCode).toBe(404);

    const archive = await app.inject({
      method: 'DELETE',
      url: `/api/2026-05-20/products/${b.productPubId}`,
      headers: H(tokenA),
    });
    expect(archive.statusCode).toBe(404);
  });

  it('A cannot edit B shipping rate', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/settings/shipping/rates/${b.rateId}`,
      headers: H(tokenA),
      payload: { amount: '1' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('A admin lists contain zero B rows', async () => {
    const orders = await app.inject({
      method: 'GET',
      url: '/api/2026-05-20/admin/orders',
      headers: H(tokenA),
    });
    expect(orders.json().data.total).toBe(0);

    const returns = await app.inject({
      method: 'GET',
      url: '/api/2026-05-20/admin/returns',
      headers: H(tokenA),
    });
    expect(returns.json().data.total).toBe(0);
  });

  // ---- Storefront surface: e-mail-as-bearer convention ---------------------

  it('order confirmation, invoice.pdf and tracking demand the right e-mail', async () => {
    for (const path of [
      `orders/${b.orderNumber}`,
      `orders/${b.orderNumber}/invoice.pdf`,
      `orders/${b.orderNumber}/tracking`,
    ]) {
      const wrong = await app.inject({
        method: 'GET',
        url: `/api/2026-05-20/storefront/${b.slug}/${path}?email=utocnik@example.com`,
      });
      expect(wrong.statusCode, path).toBe(404);

      const missing = await app.inject({
        method: 'GET',
        url: `/api/2026-05-20/storefront/${b.slug}/${path}`,
      });
      expect(missing.statusCode, path).toBe(404);
    }
  });

  it('B order is not reachable through another tenant slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/2026-05-20/storefront/bob-ceramics/orders/${b.orderNumber}?email=${encodeURIComponent(b.customerEmail)}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
