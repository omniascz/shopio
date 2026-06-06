/**
 * Per-shop sitemap — GET /s/{tenantSlug}/sitemap.xml (per `19-marketing-seo.md`).
 * Catalog home + categories + up to 100 newest products. Route handler form
 * (Next's sitemap.ts convention is root-only). Cached for an hour.
 */

import { getCategories, getProducts, getTenant } from '@/lib/api';

export const revalidate = 3600;

interface Ctx {
  params: Promise<{ tenantSlug: string }>;
}

function xmlEscape(v: string): string {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { tenantSlug } = await ctx.params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) return new Response('Not found', { status: 404 });

  const base = (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3030').replace(
    /\/$/,
    '',
  );
  const shopBase = `${base}/s/${tenantSlug}`;

  const [{ products }, categories] = await Promise.all([
    getProducts(tenantSlug, { limit: 100 }),
    getCategories(tenantSlug),
  ]);

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: shopBase, priority: '1.0' },
    ...categories.map((c) => ({
      loc: `${shopBase}?kategorie=${encodeURIComponent(c.slug)}`,
      priority: '0.7',
    })),
    ...products.map((p) => ({
      loc: `${shopBase}/p/${p.slug}`,
      priority: '0.8',
      ...(p.published_at && { lastmod: p.published_at.slice(0, 10) }),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
