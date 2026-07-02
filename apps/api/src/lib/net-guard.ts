/**
 * SSRF guard for merchant-supplied outbound URLs (flow `webhook` actions, and
 * any future user-configured callbacks). A multi-tenant host must not let a
 * tenant point a server-side request at the internal network or the cloud
 * metadata endpoint.
 *
 * Pure + unit-tested. This blocks literal private/loopback/link-local hosts and
 * non-HTTP schemes. DNS-rebinding (a public name resolving to a private IP at
 * request time) is NOT covered here — resolve-then-pin is a later step.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Allow only http(s) to a public host. */
export function isPublicHttpUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme_not_http' };
  }
  const host = url.hostname.toLowerCase();
  const bare = host.replace(/^\[/, '').replace(/\]$/, ''); // strip IPv6 brackets
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: 'private_host' };
  }
  if (isPrivateIp(bare)) {
    return { ok: false, reason: 'private_ip' };
  }
  return { ok: true, url };
}

/** True for loopback / private / link-local / CGNAT / unspecified IPs. */
export function isPrivateIp(host: string): boolean {
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);

  // IPv6
  const h = host.toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local fc00::/7
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true; // link-local fe80::/10
  }
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const inner = parseIpv4(mapped[1]!);
    if (inner) return isPrivateIpv4(inner);
  }
  return false;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number) as [number, number, number, number];
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

function isPrivateIpv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  return false;
}
