/**
 * State mapping tests for the extended gateway set (per `13`):
 * GP webpay, PayU, Barion, Besteron, Twisto, PayPal.
 */

import { describe, expect, it } from 'vitest';
import { mapGpwebpayResult } from './gpwebpay';
import { mapPayuState } from './payu';
import { mapBarionState } from './barion';
import { mapBesteronState } from './besteron';
import { mapTwistoState } from './twisto';
import { mapPaypalStatus } from './paypal';

describe('mapGpwebpayResult', () => {
  it('0/0 = captured, else failed/cancelled', () => {
    expect(mapGpwebpayResult('0', '0')).toBe('captured');
    expect(mapGpwebpayResult('50', '3000')).toBe('cancelled');
    expect(mapGpwebpayResult('30', '1001')).toBe('failed');
  });
});

describe('mapPayuState', () => {
  it('COMPLETED→captured, NEW→processing, CANCELED→cancelled', () => {
    expect(mapPayuState('COMPLETED')).toBe('captured');
    expect(mapPayuState('NEW')).toBe('processing');
    expect(mapPayuState('CANCELED')).toBe('cancelled');
  });
});

describe('mapBarionState', () => {
  it('Succeeded→captured, Prepared→processing, Expired→expired', () => {
    expect(mapBarionState('Succeeded')).toBe('captured');
    expect(mapBarionState('Prepared')).toBe('processing');
    expect(mapBarionState('Expired')).toBe('expired');
  });
});

describe('mapBesteronState', () => {
  it('PAID→captured, FAIL→failed', () => {
    expect(mapBesteronState('PAID')).toBe('captured');
    expect(mapBesteronState('FAIL')).toBe('failed');
  });
});

describe('mapTwistoState', () => {
  it('confirmed→captured, authorized→processing', () => {
    expect(mapTwistoState('confirmed')).toBe('captured');
    expect(mapTwistoState('authorized')).toBe('processing');
  });
});

describe('mapPaypalStatus', () => {
  it('COMPLETED→captured, APPROVED→processing, VOIDED→cancelled', () => {
    expect(mapPaypalStatus('COMPLETED')).toBe('captured');
    expect(mapPaypalStatus('APPROVED')).toBe('processing');
    expect(mapPaypalStatus('VOIDED')).toBe('cancelled');
  });
});
