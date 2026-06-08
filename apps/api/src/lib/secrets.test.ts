/**
 * Secret-at-rest encryption tests (per `30-security.md`).
 */

import { describe, expect, it } from 'vitest';
import { sealSecret, openSecret, sealCredentials, openCredentials } from './secrets';
import type { ShopioConfig } from '../config';

const KEY = 'a'.repeat(64); // 32 bytes hex
const withKey = { SHOPIO_SECRET_KEY: KEY } as unknown as ShopioConfig;
const noKey = { SHOPIO_SECRET_KEY: undefined } as unknown as ShopioConfig;

describe('sealSecret / openSecret', () => {
  it('round-trips a value with a key', () => {
    const sealed = sealSecret(withKey, 'gopay-client-secret');
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain('gopay-client-secret');
    expect(openSecret(withKey, sealed)).toBe('gopay-client-secret');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(sealSecret(withKey, 'x')).not.toBe(sealSecret(withKey, 'x'));
  });

  it('passes through when no key is configured (dev)', () => {
    expect(sealSecret(noKey, 'plain')).toBe('plain');
    expect(openSecret(noKey, 'plain')).toBe('plain');
  });

  it('treats non-prefixed stored values as legacy plaintext', () => {
    expect(openSecret(withKey, 'legacy-plaintext')).toBe('legacy-plaintext');
  });

  it('fails closed if encrypted but no key available', () => {
    const sealed = sealSecret(withKey, 'secret');
    expect(openSecret(noKey, sealed)).toBe('');
  });

  it('empty string stays empty', () => {
    expect(sealSecret(withKey, '')).toBe('');
    expect(openSecret(withKey, null)).toBe('');
  });
});

describe('sealCredentials / openCredentials', () => {
  it('round-trips a credentials map', () => {
    const sealed = sealCredentials(withKey, { goId: '123', clientSecret: 'abc' });
    expect(sealed.goId).toMatch(/^enc:v1:/);
    const opened = openCredentials(withKey, sealed);
    expect(opened).toEqual({ goId: '123', clientSecret: 'abc' });
  });
});
