/**
 * ComGate state mapping tests (per `13`).
 */

import { describe, expect, it } from 'vitest';
import { mapComgateState } from './comgate';

describe('mapComgateState', () => {
  it('maps PAID to captured', () => {
    expect(mapComgateState('PAID')).toBe('captured');
    expect(mapComgateState('paid')).toBe('captured'); // case-insensitive
  });
  it('maps PENDING to processing', () => {
    expect(mapComgateState('PENDING')).toBe('processing');
  });
  it('maps AUTHORIZED to authorized', () => {
    expect(mapComgateState('AUTHORIZED')).toBe('authorized');
  });
  it('maps cancellations', () => {
    expect(mapComgateState('CANCELLED')).toBe('cancelled');
    expect(mapComgateState('CANCELED')).toBe('cancelled');
  });
  it('returns null for unknown states', () => {
    expect(mapComgateState('WHATEVER')).toBeNull();
  });
});
