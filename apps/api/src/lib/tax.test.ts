import { describe, expect, it } from 'vitest';
import {
  computeTax,
  isEuCountry,
  qualifiesForReverseCharge,
  serializeBreakdown,
  type ResolvedRate,
} from './tax';

// CZ 2024+ rates.
const CZ_RATES: ResolvedRate[] = [
  { taxClassCode: 'standard', rateBasisPoints: 2100 },
  { taxClassCode: 'reduced', rateBasisPoints: 1200 },
  { taxClassCode: 'zero', rateBasisPoints: 0 },
];

describe('reverse charge (EU B2B)', () => {
  it('qualifies only for cross-border EU B2B with a VAT id', () => {
    const base = { supplierCountry: 'CZ', buyerHasVatId: true };
    expect(qualifiesForReverseCharge({ ...base, buyerCountry: 'SK' })).toBe(true);
    expect(qualifiesForReverseCharge({ ...base, buyerCountry: 'DE' })).toBe(true);
    // domestic CZ→CZ is NOT reverse charge
    expect(qualifiesForReverseCharge({ ...base, buyerCountry: 'CZ' })).toBe(false);
    // no VAT id
    expect(qualifiesForReverseCharge({ supplierCountry: 'CZ', buyerCountry: 'SK', buyerHasVatId: false })).toBe(false);
    // non-EU buyer (export, not reverse charge)
    expect(qualifiesForReverseCharge({ ...base, buyerCountry: 'US' })).toBe(false);
    // explicit failed VIES validation
    expect(qualifiesForReverseCharge({ ...base, buyerCountry: 'SK', vatValidated: false })).toBe(false);
  });

  it('isEuCountry', () => {
    expect(isEuCountry('CZ')).toBe(true);
    expect(isEuCountry('sk')).toBe(true);
    expect(isEuCountry('US')).toBe(false);
    expect(isEuCountry(null)).toBe(false);
  });

  it('zero-rates lines and strips VAT from a gross input', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 60500n, taxClassCode: 'standard' }], // gross incl 21%
      rates: CZ_RATES,
      priceIncludesTax: true,
      reverseCharge: true,
    });
    expect(r.isReverseCharge).toBe(true);
    expect(r.totals.taxAmount).toBe(0n);
    expect(r.totals.grossAmount).toBe(50000n); // 60500 / 1.21 = 50000 net, no VAT added
    expect(r.lines[0]!.taxClassCode).toBe('reverse_charge');
  });

  it('zero-rates an exclusive (net) input unchanged', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 50000n, taxClassCode: 'standard' }],
      rates: CZ_RATES,
      priceIncludesTax: false,
      reverseCharge: true,
    });
    expect(r.totals.taxAmount).toBe(0n);
    expect(r.totals.grossAmount).toBe(50000n);
  });
});

describe('computeTax — VAT-inclusive (CZ B2C)', () => {
  it('extracts 21 % from a gross 599,00 CZK line', () => {
    const r = computeTax({
      lines: [{ ref: 'l1', amount: 59900n, taxClassCode: 'standard' }],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    const line = r.lines[0]!;
    // net = floor(59900 * 10000 / 12100) = 49504; tax = 10396
    expect(line.baseAmount).toBe(49504n);
    expect(line.taxAmount).toBe(10396n);
    expect(line.grossAmount).toBe(59900n);
    expect(line.taxRateBasisPoints).toBe(2100);
    expect(r.totals.grossAmount).toBe(59900n);
  });

  it('extracts 12 % cleanly from gross 112,00', () => {
    const r = computeTax({
      lines: [{ ref: 'l1', amount: 11200n, taxClassCode: 'reduced' }],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(r.lines[0]!.baseAmount).toBe(10000n);
    expect(r.lines[0]!.taxAmount).toBe(1200n);
  });

  it('charges no VAT on the zero class', () => {
    const r = computeTax({
      lines: [{ ref: 'l1', amount: 5000n, taxClassCode: 'zero' }],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(r.lines[0]!.taxAmount).toBe(0n);
    expect(r.lines[0]!.baseAmount).toBe(5000n);
  });

  it('never loses a haléř — base + tax always equals gross input', () => {
    for (const amount of [1n, 99n, 12345n, 59900n, 89900n, 1000003n]) {
      const r = computeTax({
        lines: [{ ref: 'l', amount, taxClassCode: 'standard' }],
        rates: CZ_RATES,
        priceIncludesTax: true,
      });
      expect(r.lines[0]!.baseAmount + r.lines[0]!.taxAmount).toBe(amount);
    }
  });
});

describe('computeTax — VAT-exclusive (net pricing)', () => {
  it('adds 21 % on top of a net 100,00', () => {
    const r = computeTax({
      lines: [{ ref: 'l1', amount: 10000n, taxClassCode: 'standard' }],
      rates: CZ_RATES,
      priceIncludesTax: false,
    });
    expect(r.lines[0]!.baseAmount).toBe(10000n);
    expect(r.lines[0]!.taxAmount).toBe(2100n);
    expect(r.lines[0]!.grossAmount).toBe(12100n);
  });
});

describe('computeTax — breakdown + shipping', () => {
  it('groups multiple lines by rate', () => {
    const r = computeTax({
      lines: [
        { ref: 'a', amount: 59900n, taxClassCode: 'standard' },
        { ref: 'b', amount: 40100n, taxClassCode: 'standard' },
        { ref: 'c', amount: 11200n, taxClassCode: 'reduced' },
      ],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(r.breakdown).toHaveLength(2);
    const std = r.breakdown.find((b) => b.rateBasisPoints === 2100)!;
    const red = r.breakdown.find((b) => b.rateBasisPoints === 1200)!;
    // standard base = 49504 + 33140 = 82644 (40100 → floor(401000000/12100)=33140)
    expect(std.baseAmount).toBe(82644n);
    expect(red.taxAmount).toBe(1200n);
    // sorted standard-first (higher rate)
    expect(r.breakdown[0]!.rateBasisPoints).toBe(2100);
  });

  it('taxes shipping using the shipping class', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 12100n, taxClassCode: 'standard' }],
      shippingAmount: 12100n,
      shippingTaxClass: 'standard',
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(r.shipping).not.toBeNull();
    expect(r.shipping!.taxAmount).toBe(2100n);
    expect(r.totals.taxAmount).toBe(4200n);
  });
});

describe('computeTax — rate fallback', () => {
  it('falls back to standard when the class has no rate, with a warning', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 12100n, taxClassCode: 'super_reduced' }],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(r.lines[0]!.taxRateBasisPoints).toBe(2100);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('charges 0 % when no rates at all are configured', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 12100n, taxClassCode: 'standard' }],
      rates: [],
      priceIncludesTax: true,
    });
    expect(r.lines[0]!.taxAmount).toBe(0n);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('serializeBreakdown', () => {
  it('renders BigInt minor units as strings', () => {
    const r = computeTax({
      lines: [{ ref: 'a', amount: 59900n, taxClassCode: 'standard' }],
      rates: CZ_RATES,
      priceIncludesTax: true,
    });
    expect(serializeBreakdown(r.breakdown)).toEqual([
      { tax_class: 'standard', rate_basis_points: 2100, base_amount: '49504', tax_amount: '10396' },
    ]);
  });
});
