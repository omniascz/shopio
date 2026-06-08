/**
 * Pure-function tests for bundle availability (per `06` §3.5). The DB-backed
 * composition + cycle detection are covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import { bundleAvailableQuantity, type BundleComponent } from './bundles';

function comp(over: Partial<BundleComponent>): BundleComponent {
  return {
    id: 'bi',
    childVariantId: 'v',
    childVariantPubId: 'prv_x',
    productPubId: 'prd_x',
    productSlug: 'x',
    title: 'X',
    variantTitle: 'Default',
    sku: null,
    quantity: 1,
    isOptional: false,
    position: 0,
    availableUnits: 10,
    allowBackorder: false,
    ...over,
  };
}

describe('bundleAvailableQuantity', () => {
  it('is the min over required children of floor(available/qty)', () => {
    const c = [comp({ availableUnits: 10, quantity: 1 }), comp({ availableUnits: 9, quantity: 2 })];
    expect(bundleAvailableQuantity(c)).toBe(4); // floor(9/2)=4 < 10
  });

  it('ignores optional components', () => {
    const c = [
      comp({ availableUnits: 5, quantity: 1 }),
      comp({ availableUnits: 0, quantity: 1, isOptional: true }),
    ];
    expect(bundleAvailableQuantity(c)).toBe(5);
  });

  it('treats backorder children as unlimited', () => {
    const c = [comp({ availableUnits: 3 }), comp({ availableUnits: 0, allowBackorder: true })];
    expect(bundleAvailableQuantity(c)).toBe(3);
  });

  it('returns 0 for an empty bundle', () => {
    expect(bundleAvailableQuantity([])).toBe(0);
  });

  it('returns Infinity when every required child is backorder', () => {
    const c = [comp({ allowBackorder: true }), comp({ allowBackorder: true })];
    expect(bundleAvailableQuantity(c)).toBe(Infinity);
  });
});
