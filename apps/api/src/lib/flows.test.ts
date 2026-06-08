/**
 * Flow condition-evaluator tests (P3). Pure logic; the DB-backed runner is
 * covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import { buildOrderContext, evaluateConditions } from './flows';

const ctx = { total: 600000, currency: 'CZK', country: 'CZ', payment_method: 'cod', item_count: 3, has_coupon: 0 };

describe('evaluateConditions', () => {
  it('empty conditions always match', () => {
    expect(evaluateConditions([], ctx)).toBe(true);
  });

  it('AND semantics — all must hold', () => {
    expect(
      evaluateConditions(
        [{ field: 'total', op: 'gte', value: 500000 }, { field: 'payment_method', op: 'eq', value: 'cod' }],
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        [{ field: 'total', op: 'gte', value: 500000 }, { field: 'country', op: 'eq', value: 'SK' }],
        ctx,
      ),
    ).toBe(false);
  });

  it('numeric ops', () => {
    expect(evaluateConditions([{ field: 'total', op: 'gt', value: 500000 }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'total', op: 'lt', value: 500000 }], ctx)).toBe(false);
    expect(evaluateConditions([{ field: 'item_count', op: 'lte', value: 3 }], ctx)).toBe(true);
  });

  it('eq/neq/contains/in', () => {
    expect(evaluateConditions([{ field: 'country', op: 'neq', value: 'SK' }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'payment_method', op: 'contains', value: 'CO' }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'country', op: 'in', value: ['CZ', 'SK'] }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'country', op: 'in', value: ['PL', 'DE'] }], ctx)).toBe(false);
  });

  it('missing field never matches', () => {
    expect(evaluateConditions([{ field: 'nope', op: 'eq', value: 'x' }], ctx)).toBe(false);
  });

  it('non-array conditions are false', () => {
    expect(evaluateConditions(null, ctx)).toBe(false);
    expect(evaluateConditions({}, ctx)).toBe(false);
  });
});

describe('buildOrderContext', () => {
  it('maps an order into the context fields', () => {
    const c = buildOrderContext({
      totalAmount: 121000n,
      currency: 'CZK',
      shippingAddress: { countryCode: 'CZ' },
      paymentMethod: 'gopay',
      status: 'paid',
      couponCode: 'LETO',
      itemCount: 2,
    });
    expect(c).toEqual({
      total: 121000, currency: 'CZK', country: 'CZ', payment_method: 'gopay',
      item_count: 2, has_coupon: 1, status: 'paid',
    });
  });
});
