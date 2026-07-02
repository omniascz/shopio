import { describe, expect, it } from 'vitest';
import { isPublicHttpUrl, isPrivateIp } from './net-guard';

describe('isPublicHttpUrl', () => {
  it('allows public https/http', () => {
    expect(isPublicHttpUrl('https://hooks.example.com/x').ok).toBe(true);
    expect(isPublicHttpUrl('http://api.partner.io/webhook').ok).toBe(true);
  });

  it('blocks non-http schemes', () => {
    for (const u of ['ftp://x/y', 'file:///etc/passwd', 'gopher://x', 'javascript:alert(1)']) {
      const r = isPublicHttpUrl(u);
      expect(r.ok).toBe(false);
    }
  });

  it('blocks localhost and internal TLDs', () => {
    for (const u of ['http://localhost/x', 'http://api.local/x', 'http://svc.internal/x']) {
      expect(isPublicHttpUrl(u).ok).toBe(false);
    }
  });

  it('blocks private + loopback + metadata IPs', () => {
    for (const u of [
      'http://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://192.168.1.1/x',
      'http://172.16.0.1/x',
      'http://169.254.169.254/latest/meta-data/', // cloud metadata
      'http://[::1]/x',
    ]) {
      expect(isPublicHttpUrl(u).ok).toBe(false);
    }
  });

  it('rejects garbage', () => {
    expect(isPublicHttpUrl('not a url').ok).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('classifies ranges', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('172.15.0.1')).toBe(false); // just outside 172.16/12
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('172.20.0.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true); // CGNAT
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true); // v4-mapped
  });
});
