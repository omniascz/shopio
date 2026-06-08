/**
 * ThePay state mapping tests (per `13`).
 */

import { describe, expect, it } from 'vitest';
import { mapThepayState } from './thepay';

describe('mapThepayState', () => {
  it('maps paid to captured', () => {
    expect(mapThepayState('paid')).toBe('captured');
  });
  it('maps waiting/created to processing', () => {
    expect(mapThepayState('waiting_for_payment')).toBe('processing');
    expect(mapThepayState('created')).toBe('processing');
  });
  it('maps refunds + cancel + expiry', () => {
    expect(mapThepayState('refunded')).toBe('refunded');
    expect(mapThepayState('partially_refunded')).toBe('partially_refunded');
    expect(mapThepayState('cancelled')).toBe('cancelled');
    expect(mapThepayState('expired')).toBe('expired');
  });
  it('returns null for unknown', () => {
    expect(mapThepayState('???')).toBeNull();
  });
});
