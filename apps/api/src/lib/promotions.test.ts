/**
 * Promotion engine tests (P2) — pure evaluation: auto discounts, BOGO, stacking.
 */

import { describe, expect, it } from 'vitest';
import { evaluatePromotions } from './promotions';
import { schema } from '@shopio/db';

type Promotion = typeof schema.promotions.$inferSelect;

function promo(over: Partial<Promotion>): Promotion {
  return {
    id: 'p', tenantId: 't', pubId: 'prm_x', name: 'P', kind: 'order_percentage',
    value: 0n, currency: null, maxDiscountAmount: null, minSubtotal: 0n, minQuantity: 0,
    buyQuantity: 0, getQuantity: 0, getDiscountBps: 10000, priority: 0, stackable: true,
    startsAt: null, endsAt: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as Promotion;
}

const cart = (goods: bigint, shipping: bigint, lines: { unitPrice: bigint; quantity: number }[]) => ({
  goodsGross: goods, shippingGross: shipping, lines,
});

describe('order-level promotions', () => {
  it('order_percentage applies when minSubtotal met', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'order_percentage', value: 1000n, minSubtotal: 100000n })],
      cart(120000n, 9900n, [{ unitPrice: 120000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(12000n); // 10% of 120000
    expect(r.applied).toHaveLength(1);
  });

  it('does NOT apply below minSubtotal', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'order_percentage', value: 1000n, minSubtotal: 200000n })],
      cart(120000n, 0n, [{ unitPrice: 120000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(0n);
    expect(r.applied).toHaveLength(0);
  });

  it('free_shipping zeroes shipping', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'free_shipping', minSubtotal: 100000n })],
      cart(150000n, 9900n, [{ unitPrice: 150000n, quantity: 1 }]),
    );
    expect(r.shippingDiscount).toBe(9900n);
  });

  it('order_fixed capped to goods', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'order_fixed', value: 50000n })],
      cart(30000n, 0n, [{ unitPrice: 30000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(30000n); // clamped
  });

  it('respects maxDiscountAmount cap', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'order_percentage', value: 5000n, maxDiscountAmount: 10000n })],
      cart(100000n, 0n, [{ unitPrice: 100000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(10000n); // 50% would be 50000, capped at 10000
  });
});

describe('BOGO', () => {
  it('buy 2 get 1 free discounts the cheapest unit per group of 3', () => {
    // 3 units: 100, 200, 300 (cheapest 100 free)
    const r = evaluatePromotions(
      [promo({ kind: 'bogo', buyQuantity: 2, getQuantity: 1, getDiscountBps: 10000 })],
      cart(60000n, 0n, [
        { unitPrice: 10000n, quantity: 1 },
        { unitPrice: 20000n, quantity: 1 },
        { unitPrice: 30000n, quantity: 1 },
      ]),
    );
    expect(r.goodsDiscount).toBe(10000n); // cheapest unit free
  });

  it('buy 1 get 1 at 50% — 4 identical units → 2 groups, 2 discounted units', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'bogo', buyQuantity: 1, getQuantity: 1, getDiscountBps: 5000 })],
      cart(40000n, 0n, [{ unitPrice: 10000n, quantity: 4 }]),
    );
    // group=2, groups=2, discounted=2 units × 10000 × 50% = 10000
    expect(r.goodsDiscount).toBe(10000n);
  });

  it('does not apply without enough units', () => {
    const r = evaluatePromotions(
      [promo({ kind: 'bogo', buyQuantity: 2, getQuantity: 1 })],
      cart(20000n, 0n, [{ unitPrice: 10000n, quantity: 2 }]), // only 2 units, need 3
    );
    expect(r.goodsDiscount).toBe(0n);
  });
});

describe('stacking', () => {
  it('stackable promotions sum', () => {
    const r = evaluatePromotions(
      [
        promo({ pubId: 'a', kind: 'order_percentage', value: 1000n, stackable: true }),
        promo({ pubId: 'b', kind: 'order_fixed', value: 5000n, stackable: true }),
      ],
      cart(100000n, 0n, [{ unitPrice: 100000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(15000n); // 10000 + 5000
    expect(r.applied).toHaveLength(2);
  });

  it('a non-stackable match applies exclusively (best value)', () => {
    const r = evaluatePromotions(
      [
        promo({ pubId: 'a', kind: 'order_percentage', value: 1000n, stackable: true }), // 10000
        promo({ pubId: 'b', kind: 'order_fixed', value: 25000n, stackable: false }), // 25000, exclusive
      ],
      cart(100000n, 0n, [{ unitPrice: 100000n, quantity: 1 }]),
    );
    expect(r.goodsDiscount).toBe(25000n);
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0]!.pubId).toBe('b');
  });
});
