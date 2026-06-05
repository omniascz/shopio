/**
 * Shipment helpers tests — state machine, weight, shippable qty, name split.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITEM_WEIGHT_GRAMS,
  computeShipmentWeight,
  formatShipmentNumber,
  isValidShipmentTransition,
  shippableQuantity,
  splitRecipientName,
} from './shipments';

describe('state machine', () => {
  it('walks the happy path', () => {
    expect(isValidShipmentTransition('pending', 'label_generated')).toBe(true);
    expect(isValidShipmentTransition('label_generated', 'handed_over')).toBe(true);
    expect(isValidShipmentTransition('handed_over', 'delivered')).toBe(true);
  });

  it('allows cancellation only pre-handover (RULE-SHIP-030)', () => {
    expect(isValidShipmentTransition('pending', 'cancelled')).toBe(true);
    expect(isValidShipmentTransition('label_generated', 'cancelled')).toBe(true);
    expect(isValidShipmentTransition('handed_over', 'cancelled')).toBe(false);
    expect(isValidShipmentTransition('delivered', 'cancelled')).toBe(false);
  });

  it('forbids skipping label generation', () => {
    expect(isValidShipmentTransition('pending', 'handed_over')).toBe(false);
    expect(isValidShipmentTransition('pending', 'delivered')).toBe(false);
  });
});

describe('computeShipmentWeight', () => {
  it('sums variant weights × quantity', () => {
    expect(
      computeShipmentWeight([
        { quantity: 2, weightGrams: 800 },
        { quantity: 1, weightGrams: 350 },
      ]),
    ).toBe(1950);
  });

  it('falls back to the default for unweighted variants (RULE-SHIP-003)', () => {
    expect(computeShipmentWeight([{ quantity: 3, weightGrams: null }])).toBe(
      3 * DEFAULT_ITEM_WEIGHT_GRAMS,
    );
  });
});

describe('shippableQuantity', () => {
  it('subtracts live shipments, releases cancelled', () => {
    expect(
      shippableQuantity(5, [
        { quantity: 2, status: 'handed_over' },
        { quantity: 1, status: 'pending' },
        { quantity: 2, status: 'cancelled' },
      ]),
    ).toBe(2);
  });

  it('never goes negative', () => {
    expect(shippableQuantity(1, [{ quantity: 3, status: 'delivered' }])).toBe(0);
  });
});

describe('splitRecipientName', () => {
  it('splits first/last names', () => {
    expect(splitRecipientName('Jan Novák', 'x@y.cz')).toEqual({ name: 'Jan', surname: 'Novák' });
    expect(splitRecipientName('Marie Anna Nováková', 'x@y.cz')).toEqual({
      name: 'Marie Anna',
      surname: 'Nováková',
    });
  });

  it('handles single names and missing names', () => {
    expect(splitRecipientName('Madonna', 'x@y.cz')).toEqual({ name: 'Madonna', surname: '—' });
    expect(splitRecipientName(null, 'jan.novak@y.cz')).toEqual({
      name: 'jan.novak',
      surname: '—',
    });
  });
});

describe('formatShipmentNumber', () => {
  it('formats SHP numbers', () => {
    expect(formatShipmentNumber(2026, 7)).toBe('SHP-2026-0007');
  });
});
