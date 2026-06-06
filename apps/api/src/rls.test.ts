/**
 * RLS enforcement regression — per `30-security.md` + migration
 * `0020_rls_tenant_isolation`.
 *
 * Proves the database itself (not just explicit WHERE filters) confines rows to
 * the active tenant when queried via the non-superuser `shopio_app` role +
 * `withTenant`. Two tenants each get a coupon; then:
 *   1. A raw `SELECT * FROM coupons` (NO tenant filter) under withTenant(A)
 *      returns only A's coupon — i.e. RLS does the gating.
 *   2. Attacker A cannot see/modify B's coupon over the HTTP admin API.
 *
 * Gated behind RUN_DB_TESTS=1 (dev: `pnpm test:isolation`).
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('RLS tenant isolation', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });

  const made: Record<string, { token: string; tenantUuid: string; couponPubId: string }> = {};

  async function makeMerchantWithCoupon(name: string, code: string) {
    const email = `rls-${name}-${ts}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/signup',
      payload: { email, password: 'RlsHeslo2026!XY' },
    });
    const li = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/login',
      payload: { email, password: 'RlsHeslo2026!XY' },
    });
    let token = li.json().data.access_token as string;
    const ct = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/tenants',
      headers: H(token),
      payload: { displayName: `RLS ${name} ${ts}`, slug: `rls-${name}-${ts}`, countryCode: 'CZ' },
    });
    const tenantPubId = ct.json().data.tenant.id as string;
    const sw = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/auth/switch-tenant',
      headers: H(token),
      payload: { tenantId: tenantPubId },
    });
    token = sw.json().data.access_token as string;

    const cp = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/coupons',
      headers: H(token),
      payload: { code, kind: 'fixed', value: '10000', currency: 'CZK' },
    });
    const couponPubId = cp.json().data.id as string;
    return { token, tenantPubId, couponPubId };
  }

  beforeAll(async () => {
    const { buildServer } = await import('./server');
    app = await buildServer();
    const a = await makeMerchantWithCoupon('atk', `ATK${ts}`);
    const b = await makeMerchantWithCoupon('vic', `VIC${ts}`);
    // resolve tenant UUIDs
    const { getDb } = await import('./db');
    const { getConfig } = await import('./config');
    const db = getDb(getConfig());
    const [ta] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, `rls-atk-${ts}`))
      .limit(1);
    const [tb] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, `rls-vic-${ts}`))
      .limit(1);
    made.atk = { token: a.token, tenantUuid: ta!.id, couponPubId: a.couponPubId };
    made.vic = { token: b.token, tenantUuid: tb!.id, couponPubId: b.couponPubId };
  });

  afterAll(async () => {
    await app?.close();
  });

  it('raw SELECT (no filter) under withTenant returns only the active tenant rows', async () => {
    const { getRlsDb } = await import('./db');
    const { getConfig } = await import('./config');
    const rlsDb = getRlsDb(getConfig());

    const aRows = await withTenant(rlsDb, made.atk.tenantUuid, (tx) =>
      tx.select({ id: schema.coupons.id, tenantId: schema.coupons.tenantId }).from(schema.coupons),
    );
    // every visible row belongs to A; none belongs to B
    expect(aRows.length).toBeGreaterThan(0);
    expect(aRows.every((r) => r.tenantId === made.atk.tenantUuid)).toBe(true);
    expect(aRows.some((r) => r.tenantId === made.vic.tenantUuid)).toBe(false);
  });

  it('attacker cannot list the victim coupon via the admin API', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/2026-05-20/admin/coupons',
      headers: H(made.atk.token),
    });
    const ids = (res.json().data.coupons as { id: string }[]).map((c) => c.id);
    expect(ids).not.toContain(made.vic.couponPubId);
  });

  it('attacker cannot modify the victim coupon (404)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/2026-05-20/admin/coupons/${made.vic.couponPubId}`,
      headers: H(made.atk.token),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(404);
  });
});
