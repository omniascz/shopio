import { describe, expect, it } from 'vitest';
import { openCarrierOptions, sealCarrierOptions } from './secrets';
import type { ShopioConfig } from '../../config';

const withKey = { SHOPIO_SECRET_KEY: 'a'.repeat(64) } as unknown as ShopioConfig; // 32-byte hex
const noKey = {} as ShopioConfig;

describe('carrier options encryption', () => {
  it('seals secret keys, leaves non-secret keys alone', () => {
    const sealed = sealCarrierOptions(withKey, {
      api_password: 'super-secret',
      api_key: 'widget-123',
      home_delivery_carrier_id: '106',
    });
    expect(String(sealed.api_password)).toMatch(/^enc:v1:/);
    expect(String(sealed.api_key)).toMatch(/^enc:v1:/);
    expect(sealed.home_delivery_carrier_id).toBe('106'); // untouched
  });

  it('roundtrips back to plaintext', () => {
    const opts = { api_password: 'super-secret', webhook_secret: 'whx', home_delivery_carrier_id: '106' };
    const opened = openCarrierOptions(withKey, sealCarrierOptions(withKey, opts));
    expect(opened.api_password).toBe('super-secret');
    expect(opened.webhook_secret).toBe('whx');
    expect(opened.home_delivery_carrier_id).toBe('106');
  });

  it('is idempotent — does not double-encrypt an already-sealed value', () => {
    const once = sealCarrierOptions(withKey, { api_password: 'x' });
    const twice = sealCarrierOptions(withKey, once);
    expect(twice.api_password).toBe(once.api_password);
    expect(openCarrierOptions(withKey, twice).api_password).toBe('x');
  });

  it('reads legacy plaintext unchanged', () => {
    expect(openCarrierOptions(withKey, { api_password: 'legacy-plain' }).api_password).toBe('legacy-plain');
  });

  it('passthrough when no key configured', () => {
    const sealed = sealCarrierOptions(noKey, { api_password: 'x' });
    expect(sealed.api_password).toBe('x');
    expect(openCarrierOptions(noKey, sealed).api_password).toBe('x');
  });
});
