/**
 * WMS pure logic. The DB-backed applyStocktake (ledger write + on-hand
 * reconcile) is covered by the live-DB smoke, not here.
 */
import { describe, expect, it } from 'vitest';
import { computeVariance } from './wms';

describe('computeVariance', () => {
  it('counted − system', () => {
    expect(computeVariance(10, 7)).toBe(-3); // shrinkage
    expect(computeVariance(10, 13)).toBe(3); // surplus
    expect(computeVariance(5, 5)).toBe(0); // no change → no ledger movement
  });
});
