/**
 * FX tests (P1) — ČNB parser + conversion math. The live fetch fails soft and
 * isn't exercised here.
 */

import { describe, expect, it } from 'vitest';
import { convertMinor, parseCnbDaily, type CnbRate } from './fx';

const SAMPLE = `06 Jun 2026 #108
Country|Currency|Amount|Code|Rate
EMU|euro|1|EUR|25.000
Poland|zloty|1|PLN|5.000
Hungary|forint|100|HUF|6.500
United Kingdom|pound|1|GBP|29.000`;

describe('parseCnbDaily', () => {
  it('parses the header date and the rate rows', () => {
    const out = parseCnbDaily(SAMPLE);
    expect(out.fixingDate).toBe('2026-06-06');
    expect(out.rates).toHaveLength(4);
    expect(out.rates.find((r) => r.currency === 'EUR')).toEqual({ currency: 'EUR', amount: 1, rate: 25 });
    expect(out.rates.find((r) => r.currency === 'HUF')).toEqual({ currency: 'HUF', amount: 100, rate: 6.5 });
  });

  it('throws on a bad header', () => {
    expect(() => parseCnbDaily('garbage')).toThrow();
  });
});

describe('convertMinor', () => {
  const rates = new Map<string, CnbRate>([
    ['EUR', { currency: 'EUR', amount: 1, rate: 25 }], // 1 EUR = 25 CZK
    ['PLN', { currency: 'PLN', amount: 1, rate: 5 }], // 1 PLN = 5 CZK
    ['HUF', { currency: 'HUF', amount: 100, rate: 6.5 }],
  ]);

  it('CZK → EUR (250.00 CZK → 10.00 EUR)', () => {
    expect(convertMinor(25000n, 'CZK', 'EUR', rates)).toBe(1000n);
  });

  it('EUR → CZK (10.00 EUR → 250.00 CZK)', () => {
    expect(convertMinor(1000n, 'EUR', 'CZK', rates)).toBe(25000n);
  });

  it('EUR → PLN via CZK (10 EUR = 250 CZK = 50 PLN)', () => {
    expect(convertMinor(1000n, 'EUR', 'PLN', rates)).toBe(5000n);
  });

  it('same currency is identity', () => {
    expect(convertMinor(1234n, 'EUR', 'EUR', rates)).toBe(1234n);
  });

  it('rounds half-up to the nearest minor unit', () => {
    // 100 CZK → EUR at 25 = 4.00 EUR = 400 minor
    expect(convertMinor(10000n, 'CZK', 'EUR', rates)).toBe(400n);
    // 1 CZK → EUR = 0.04 → 4 minor
    expect(convertMinor(100n, 'CZK', 'EUR', rates)).toBe(4n);
  });

  it('returns null for a missing rate', () => {
    expect(convertMinor(1000n, 'EUR', 'USD', rates)).toBeNull();
  });
});
