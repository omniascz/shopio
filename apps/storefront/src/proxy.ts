/**
 * Host-based tenant routing for custom domains (per `22`).
 *
 * A merchant can point their own domain (obchod.example.cz) at the platform;
 * this middleware rewrites such requests to the shop's `/s/{slug}/…` path so the
 * storefront renders at the domain root.
 *
 * SAFETY: the platform host(s) early-return untouched, paths already under /s/
 * are skipped, and any resolve failure falls through to normal behavior
 * (fail-open). So existing storefronts on the platform host are unaffected —
 * only requests to a registered custom domain are rewritten.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PLATFORM_HOSTS = (process.env.NEXT_PUBLIC_PLATFORM_HOSTS ?? 'localhost:3030,localhost,127.0.0.1')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const API_BASE = process.env.SHOPIO_API_URL ?? 'http://localhost:4040';

export const config = {
  // Skip Next internals + assets; act on page navigations only.
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)'],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const { pathname } = req.nextUrl;

  // Platform host, no host, or already shop-scoped → leave untouched.
  if (!host || PLATFORM_HOSTS.includes(host) || pathname.startsWith('/s/')) {
    return NextResponse.next();
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/2026-05-20/storefront/resolve-domain?host=${encodeURIComponent(host)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return NextResponse.next();
    const body = (await res.json()) as { data?: { slug?: string } };
    const slug = body.data?.slug;
    if (!slug) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = `/s/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  } catch {
    return NextResponse.next();
  }
}
