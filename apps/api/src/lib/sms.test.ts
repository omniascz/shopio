import { describe, expect, it, vi, afterEach } from 'vitest';
import { isSmsEnabled, sendSms } from './sms';
import type { ShopioConfig } from '../config';

const base = { SMS_GATEWAY_URL: '', SMS_API_KEY: '', SMS_SENDER: '', SMS_ENABLED: false } as unknown as ShopioConfig;

describe('sms', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is disabled without a gateway url', () => {
    expect(isSmsEnabled({ ...base })).toBe(false);
    expect(isSmsEnabled({ ...base, SMS_ENABLED: true })).toBe(false);
    expect(isSmsEnabled({ ...base, SMS_GATEWAY_URL: 'https://gw' })).toBe(false); // enabled flag off
    expect(isSmsEnabled({ ...base, SMS_ENABLED: true, SMS_GATEWAY_URL: 'https://gw' })).toBe(true);
  });

  it('no-ops (returns false) when not configured, without calling fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const ok = await sendSms({ ...base }, { to: '+420777000111', text: 'ahoj' });
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('POSTs to the gateway with bearer + sender when configured', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    const cfg = {
      ...base,
      SMS_ENABLED: true,
      SMS_GATEWAY_URL: 'https://gw.example/send',
      SMS_API_KEY: 'k123',
      SMS_SENDER: 'Shopio',
    } as ShopioConfig;
    const ok = await sendSms(cfg, { to: '+420777000111', text: 'ahoj' });
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    const [url, opts] = spy.mock.calls[0]!;
    expect(url).toBe('https://gw.example/send');
    expect((opts as RequestInit).method).toBe('POST');
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer k123');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body).toMatchObject({ to: '+420777000111', text: 'ahoj', from: 'Shopio' });
  });
});
