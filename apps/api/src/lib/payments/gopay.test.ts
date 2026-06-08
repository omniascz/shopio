/**
 * GoPay state mapping tests (per `13 §11.2`).
 */

import { describe, expect, it } from 'vitest';
import { mapGopayState } from './gopay';

describe('mapGopayState', () => {
  it('maps PAID to captured', () => {
    expect(mapGopayState('PAID')).toBe('captured');
  });

  it('maps AUTHORIZED to authorized', () => {
    expect(mapGopayState('AUTHORIZED')).toBe('authorized');
  });

  it('maps creation/method states to processing', () => {
    expect(mapGopayState('CREATED')).toBe('processing');
    expect(mapGopayState('PAYMENT_METHOD_CHOSEN')).toBe('processing');
  });

  it('maps cancellation + timeout to terminal states', () => {
    expect(mapGopayState('CANCELED')).toBe('cancelled');
    expect(mapGopayState('TIMEOUTED')).toBe('expired');
  });

  it('maps refund states', () => {
    expect(mapGopayState('REFUNDED')).toBe('refunded');
    expect(mapGopayState('PARTIALLY_REFUNDED')).toBe('partially_refunded');
  });

  it('returns null for unknown states', () => {
    expect(mapGopayState('SOMETHING_NEW')).toBeNull();
  });
});
