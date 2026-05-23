import { describe, expect, it } from 'vitest';
import { calculateShippingOptions, type ShippingRateRow } from './shipping';

function rate(over: Partial<ShippingRateRow>): ShippingRateRow {
  return {
    id: 'r',
    carrierCode: 'zasilkovna',
    serviceCode: 'pickup_point',
    displayName: 'Zásilkovna',
    description: null,
    kind: 'flat',
    amount: 7900n,
    currency: 'CZK',
    tiers: null,
    freeAboveAmount: null,
    pickupOnly: false,
    supportsCod: false,
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
    minWeightGrams: null,
    maxWeightGrams: null,
    priority: 0,
    ...over,
  };
}

describe('calculateShippingOptions', () => {
  it('returns a flat rate as-is', () => {
    const [opt] = calculateShippingOptions([rate({ amount: 7900n })], {
      totalWeightGrams: 500,
      subtotalAmount: 50000n,
    });
    expect(opt!.amount).toBe('7900');
    expect(opt!.free).toBe(false);
  });

  it('free_above_threshold: free when subtotal reaches the threshold', () => {
    const r = rate({ kind: 'free_above_threshold', amount: 7900n, freeAboveAmount: 150000n });
    const below = calculateShippingOptions([r], { totalWeightGrams: 500, subtotalAmount: 149999n });
    const at = calculateShippingOptions([r], { totalWeightGrams: 500, subtotalAmount: 150000n });
    expect(below[0]!.amount).toBe('7900');
    expect(at[0]!.amount).toBe('0');
    expect(at[0]!.free).toBe(true);
  });

  it('weight_based: picks the first tier whose upper bound covers the weight', () => {
    const r = rate({
      kind: 'weight_based',
      amount: 19900n, // fallback above all tiers
      tiers: [
        { max_weight_grams: 1000, amount: 7900 },
        { max_weight_grams: 5000, amount: 11900 },
      ],
    });
    expect(
      calculateShippingOptions([r], { totalWeightGrams: 800, subtotalAmount: 0n })[0]!.amount,
    ).toBe('7900');
    expect(
      calculateShippingOptions([r], { totalWeightGrams: 3000, subtotalAmount: 0n })[0]!.amount,
    ).toBe('11900');
    // above all tiers → fallback flat amount
    expect(
      calculateShippingOptions([r], { totalWeightGrams: 9000, subtotalAmount: 0n })[0]!.amount,
    ).toBe('19900');
  });

  it('filters out rates whose weight constraints the cart violates', () => {
    const r = rate({ maxWeightGrams: 1000 });
    const opts = calculateShippingOptions([r], { totalWeightGrams: 2000, subtotalAmount: 0n });
    expect(opts).toHaveLength(0);
  });

  it('sorts by priority DESC then amount ASC', () => {
    const cheap = rate({ id: 'cheap', amount: 7900n, priority: 0, serviceCode: 'pickup_point' });
    const pricey = rate({ id: 'pricey', amount: 11900n, priority: 0, serviceCode: 'home' });
    const featured = rate({ id: 'featured', amount: 9900n, priority: 10, serviceCode: 'x' });
    const opts = calculateShippingOptions([cheap, pricey, featured], {
      totalWeightGrams: 500,
      subtotalAmount: 0n,
    });
    expect(opts.map((o) => o.rate_id)).toEqual(['featured', 'cheap', 'pricey']);
  });

  it('flags pickup-point services so checkout can require a point', () => {
    const [opt] = calculateShippingOptions([rate({ pickupOnly: true })], {
      totalWeightGrams: 500,
      subtotalAmount: 0n,
    });
    expect(opt!.requires_pickup_point).toBe(true);
  });
});
