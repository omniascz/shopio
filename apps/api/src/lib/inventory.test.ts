/**
 * Inventory pure-math tests — availability + reservation coverage semantics
 * per `09-inventory.md`.
 */

import { describe, expect, it } from 'vitest';
import { availableQuantity, coveredQuantity, UNPAID_RESERVATION_TTL_HOURS } from './inventory';

describe('availableQuantity', () => {
  it('is on hand minus reserved', () => {
    expect(availableQuantity({ stockOnHand: 10, stockReserved: 3 })).toBe(7);
    expect(availableQuantity({ stockOnHand: 5, stockReserved: 0 })).toBe(5);
  });

  it('can go negative for oversold/backorder situations', () => {
    expect(availableQuantity({ stockOnHand: 2, stockReserved: 5 })).toBe(-3);
  });
});

describe('coveredQuantity', () => {
  it('caps physical decrement at the active hold', () => {
    expect(coveredQuantity(2, 2)).toBe(2); // fully reserved → full decrement
    expect(coveredQuantity(2, 1)).toBe(1); // partially reserved
    expect(coveredQuantity(1, 5)).toBe(1); // ship less than held
  });

  it('returns 0 for pre-reservation orders (no hold — stock already out)', () => {
    expect(coveredQuantity(3, 0)).toBe(0);
  });

  it('never goes negative', () => {
    expect(coveredQuantity(0, 5)).toBe(0);
    expect(coveredQuantity(-1, 5)).toBe(0);
  });
});

describe('UNPAID_RESERVATION_TTL_HOURS', () => {
  it('outlives the 24h Stripe Checkout session window', () => {
    expect(UNPAID_RESERVATION_TTL_HOURS).toBeGreaterThanOrEqual(24);
  });
});
