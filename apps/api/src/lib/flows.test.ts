/**
 * Flow condition-evaluator tests (P3). Pure logic; the DB-backed runner is
 * covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import {
  buildOrderContext,
  buildWebhookPayload,
  computeBackoffMs,
  evaluateConditions,
} from './flows';

const ctx = {
  total: 600000,
  currency: 'CZK',
  country: 'CZ',
  payment_method: 'cod',
  item_count: 3,
  has_coupon: 0,
  status: 'paid',
  customer_email: 'jan@example.cz',
};

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

  it('not_contains / starts_with / ends_with (case-insensitive)', () => {
    expect(evaluateConditions([{ field: 'payment_method', op: 'not_contains', value: 'card' }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'payment_method', op: 'not_contains', value: 'CO' }], ctx)).toBe(false);
    expect(evaluateConditions([{ field: 'customer_email', op: 'ends_with', value: '.CZ' }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'customer_email', op: 'starts_with', value: 'JAN' }], ctx)).toBe(true);
    expect(evaluateConditions([{ field: 'customer_email', op: 'starts_with', value: 'petr' }], ctx)).toBe(false);
  });

  it('missing field never matches', () => {
    expect(evaluateConditions([{ field: 'nope', op: 'eq', value: 'x' }], ctx)).toBe(false);
  });

  it('non-array / empty-object conditions are false', () => {
    expect(evaluateConditions(null, ctx)).toBe(false);
    expect(evaluateConditions({}, ctx)).toBe(false);
    expect(evaluateConditions('nope', ctx)).toBe(false);
  });
});

describe('evaluateConditions — AND/OR groups', () => {
  it('all[] is AND', () => {
    expect(
      evaluateConditions({ all: [{ field: 'country', op: 'eq', value: 'CZ' }, { field: 'has_coupon', op: 'eq', value: 0 }] }, ctx),
    ).toBe(true);
    expect(
      evaluateConditions({ all: [{ field: 'country', op: 'eq', value: 'CZ' }, { field: 'has_coupon', op: 'eq', value: 1 }] }, ctx),
    ).toBe(false);
  });

  it('any[] is OR — at least one holds', () => {
    expect(
      evaluateConditions({ any: [{ field: 'country', op: 'eq', value: 'SK' }, { field: 'payment_method', op: 'eq', value: 'cod' }] }, ctx),
    ).toBe(true);
    expect(
      evaluateConditions({ any: [{ field: 'country', op: 'eq', value: 'SK' }, { field: 'payment_method', op: 'eq', value: 'card' }] }, ctx),
    ).toBe(false);
  });

  it('all AND any together', () => {
    expect(
      evaluateConditions(
        {
          all: [{ field: 'total', op: 'gte', value: 500000 }],
          any: [{ field: 'payment_method', op: 'eq', value: 'cod' }, { field: 'country', op: 'eq', value: 'SK' }],
        },
        ctx,
      ),
    ).toBe(true);
    // all fails → whole thing fails even though any holds
    expect(
      evaluateConditions(
        {
          all: [{ field: 'total', op: 'gte', value: 9000000 }],
          any: [{ field: 'payment_method', op: 'eq', value: 'cod' }],
        },
        ctx,
      ),
    ).toBe(false);
  });
});

describe('computeBackoffMs', () => {
  it('doubles per attempt from 1 minute', () => {
    expect(computeBackoffMs(1)).toBe(60_000);
    expect(computeBackoffMs(2)).toBe(120_000);
    expect(computeBackoffMs(3)).toBe(240_000);
  });

  it('caps at 6 hours', () => {
    expect(computeBackoffMs(99)).toBe(6 * 60 * 60_000);
    expect(computeBackoffMs(0)).toBe(60_000);
  });
});

describe('buildWebhookPayload', () => {
  it('shapes the order into a stable POST body', () => {
    const payload = buildWebhookPayload('order.paid', {
      tenantId: 't1',
      orderId: 'o1',
      orderNumber: '2026-0001',
      context: ctx,
    });
    expect(payload).toEqual({
      event: 'order.paid',
      order: {
        id: 'o1',
        number: '2026-0001',
        total: 600000,
        currency: 'CZK',
        status: 'paid',
        payment_method: 'cod',
      },
    });
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
      customerEmail: 'jan@example.cz',
    });
    expect(c).toEqual({
      total: 121000, currency: 'CZK', country: 'CZ', payment_method: 'gopay',
      item_count: 2, has_coupon: 1, status: 'paid', customer_email: 'jan@example.cz',
    });
  });
});
