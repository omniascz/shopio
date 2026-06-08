/**
 * Pays.cz status mapping tests (per `13`).
 */

import { describe, expect, it } from 'vitest';
import { mapPaysStatus } from './pays';

describe('mapPaysStatus', () => {
  it('maps accepted/paid (2,3) to captured', () => {
    expect(mapPaysStatus('2')).toBe('captured');
    expect(mapPaysStatus('3')).toBe('captured');
  });
  it('maps created (1) to processing', () => {
    expect(mapPaysStatus('1')).toBe('processing');
  });
  it('maps cancelled (4)', () => {
    expect(mapPaysStatus('4')).toBe('cancelled');
  });
  it('returns null for unknown', () => {
    expect(mapPaysStatus('99')).toBeNull();
  });
});
