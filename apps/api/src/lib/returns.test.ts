/**
 * Returns math + state machine tests — per `17-returns-refunds.md` RULE-RTN-012/013.
 */

import { describe, expect, it } from 'vitest';
import {
  ReturnError,
  computeReturnLine,
  computeShippingRefund,
  formatReturnNumber,
  isValidReturnTransition,
  returnableQuantity,
} from './returns';

// Order item: 2× 599,00 Kč gross, 21 % VAT contained (line 1198,00 / tax 207,93)
const item = {
  quantity: 2,
  unitPriceAmount: 59900n,
  lineTotalAmount: 119800n,
  lineTaxAmount: 20793n,
  taxClassCode: 'standard',
  taxRateBasisPoints: 2100,
};

describe('computeReturnLine', () => {
  it('full return reproduces exact line totals (no penny loss)', () => {
    const r = computeReturnLine(item, 2);
    expect(r.lineGrossAmount).toBe(119800n);
    expect(r.lineTaxAmount).toBe(20793n);
    expect(r.lineNetAmount).toBe(119800n - 20793n);
  });

  it('partial return is proportional with floor rounding', () => {
    const r = computeReturnLine(item, 1);
    expect(r.lineGrossAmount).toBe(59900n);
    expect(r.lineTaxAmount).toBe(10396n); // floor(20793/2)
    expect(r.lineNetAmount).toBe(49504n);
  });

  it('partials never over-refund vs the full line', () => {
    const a = computeReturnLine(item, 1);
    const b = computeReturnLine(item, 1);
    expect(a.lineGrossAmount + b.lineGrossAmount).toBeLessThanOrEqual(item.lineTotalAmount);
    expect(a.lineTaxAmount + b.lineTaxAmount).toBeLessThanOrEqual(item.lineTaxAmount);
  });

  it('rejects quantity above ordered', () => {
    expect(() => computeReturnLine(item, 3)).toThrowError(ReturnError);
  });

  it('rejects non-positive quantity', () => {
    expect(() => computeReturnLine(item, 0)).toThrowError(ReturnError);
    expect(() => computeReturnLine(item, -1)).toThrowError(ReturnError);
  });
});

describe('computeShippingRefund', () => {
  it('recovers shipping VAT from order totals', () => {
    // Order: items tax 31205, total tax 33271 → shipping tax 2066 on 11900 gross
    const s = computeShippingRefund({
      shippingAmount: 11900n,
      taxAmount: 33271n,
      orderItemTaxSum: 31205n,
    });
    expect(s.gross).toBe(11900n);
    expect(s.tax).toBe(2066n);
    expect(s.net).toBe(9834n);
  });
});

describe('returnableQuantity', () => {
  it('subtracts live returns and ignores dead ones', () => {
    expect(
      returnableQuantity(5, [
        { quantity: 2, status: 'refunded' },
        { quantity: 1, status: 'requested' },
        { quantity: 2, status: 'rejected' }, // released
      ]),
    ).toBe(2);
  });

  it('never goes negative', () => {
    expect(returnableQuantity(1, [{ quantity: 5, status: 'refunded' }])).toBe(0);
  });
});

describe('state machine', () => {
  it('walks the happy path', () => {
    expect(isValidReturnTransition('requested', 'approved')).toBe(true);
    expect(isValidReturnTransition('approved', 'received')).toBe(true);
    expect(isValidReturnTransition('received', 'refunded')).toBe(true);
  });

  it('forbids refund before receipt and any exit from terminals', () => {
    expect(isValidReturnTransition('requested', 'refunded')).toBe(false);
    expect(isValidReturnTransition('approved', 'refunded')).toBe(false);
    expect(isValidReturnTransition('refunded', 'cancelled')).toBe(false);
    expect(isValidReturnTransition('rejected', 'approved')).toBe(false);
  });
});

describe('formatReturnNumber', () => {
  it('formats RMA numbers', () => {
    expect(formatReturnNumber(2026, 1)).toBe('RMA-2026-0001');
    expect(formatReturnNumber(2026, 12345)).toBe('RMA-2026-12345');
  });
});
