/**
 * Pure-function tests for the gift card helpers (per `10` §3.7).
 * The DB-backed issue/redeem/topup flow is covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import {
  generateGiftCardCode,
  hashGiftCardCode,
  isRedeemable,
  normalizeCode,
} from './gift-cards';

describe('generateGiftCardCode', () => {
  it('formats as four dash-separated groups of four', () => {
    const code = generateGiftCardCode();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  it('avoids ambiguous letters I/L/O/U', () => {
    for (let i = 0; i < 50; i++) {
      const raw = normalizeCode(generateGiftCardCode());
      expect(raw).not.toMatch(/[ILOU]/);
    }
  });
});

describe('normalizeCode + hashGiftCardCode', () => {
  it('hashes regardless of dashes/spaces/case', () => {
    const a = hashGiftCardCode('abcd-efgh-1234-5678');
    const b = hashGiftCardCode('ABCD EFGH 1234 5678');
    const c = hashGiftCardCode('ABCDEFGH12345678');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('normalizes to dashless upper-case', () => {
    expect(normalizeCode('ab-cd 12')).toBe('ABCD12');
  });
});

describe('isRedeemable', () => {
  const now = new Date('2026-06-08T00:00:00Z');
  it('true for active, positive balance, unexpired', () => {
    expect(isRedeemable({ status: 'active', balance: 100n, expiresAt: null }, now)).toBe(true);
  });
  it('false when revoked / spent / zero / expired', () => {
    expect(isRedeemable({ status: 'revoked', balance: 100n, expiresAt: null }, now)).toBe(false);
    expect(isRedeemable({ status: 'active', balance: 0n, expiresAt: null }, now)).toBe(false);
    expect(
      isRedeemable({ status: 'active', balance: 100n, expiresAt: new Date('2026-06-07T00:00:00Z') }, now),
    ).toBe(false);
  });
});
