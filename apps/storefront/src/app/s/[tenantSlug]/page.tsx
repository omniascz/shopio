import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney, getCategories, getHomepage, getProducts, getTenant } from '@/lib/api';
import { getStorefrontLocale } from '@/lib/locale';
import { getStorefrontCurrency } from '@/lib/currency';
import { RatingBadge } from '@/components/stars';
import { SaveButtons } from '@/components/save-buttons';
import { BlockRenderer } from '@/components/block-renderer';

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  return {
    title: tenant ? `${tenant.display_name} — Shopio` : 'Shopio',
    description: tenant ? `Shop ${tenant.display_name} on Shopio` : undefined,
  };
}

export default async function TenantCatalogPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === 'string' ? sp.q.trim() || undefined : undefined;
  const categorySlug = typeof sp.kategorie === 'string' ? sp.kategorie.trim() || undefined : undefined;

  // Active facet selections from `facet.<Name>=value` query params
  const selectedFacets: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(sp)) {
    if (!key.startsWith('facet.') || val == null) continue;
    selectedFacets[key.slice('facet.'.length)] = Array.isArray(val) ? val : [val];
  }

  const locale = await getStorefrontLocale();
  const currency = await getStorefrontCurrency();
  const [{ products, facets }, categories, homepageBlocks] = await Promise.all([
    getProducts(tenantSlug, {
      limit: 24,
      ...(q && { q }),
      ...(categorySlug && { categorySlug }),
      ...(locale && { locale }),
      ...(currency && { currency }),
      facets: selectedFacets,
    }),
    getCategories(tenantSlug, locale),
    getHomepage(tenantSlug),
  ]);

  // Homepage page-builder blocks (per `32`) — shown above the catalog. Only on
  // the unfiltered landing view (a search / category / facet drill-down is a
  // catalog listing, not the marketing homepage).
  const isLanding = !q && !categorySlug && Object.keys(selectedFacets).length === 0;
  const showBlocks = isLanding && homepageBlocks.length > 0;

  // Helper to build a URL with one facet value toggled, preserving the rest
  function facetHref(name: string, value: string): string {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (categorySlug) next.set('kategorie', categorySlug);
    const current = selectedFacets[name] ?? [];
    const isActive = current.includes(value);
    for (const [n, vals] of Object.entries(selectedFacets)) {
      for (const v of vals) {
        if (n === name && v === value) continue; // toggle off
        next.append(`facet.${n}`, v);
      }
    }
    if (!isActive) next.append(`facet.${name}`, value);
    const qs = next.toString();
    return `/s/${tenantSlug}${qs ? `?${qs}` : ''}`;
  }
  const anyFacetActive = Object.values(selectedFacets).some((v) => v.length > 0);

  const hero = tenant.homepage?.hero;
  // Block-built homepage replaces the single legacy hero when present.
  const showHero = !showBlocks && hero?.enabled && (hero.headline || hero.image_url);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--shopio-color-surface-1)' }}>
      {showBlocks && (
        <BlockRenderer blocks={homepageBlocks} tenantSlug={tenantSlug} locale={locale ?? tenant.default_locale} />
      )}
      {showHero && (
        <section
          style={{
            position: 'relative',
            padding: '4rem 2rem',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: hero!.align === 'left' ? 'flex-start' : 'center',
            textAlign: hero!.align === 'left' ? 'left' : 'center',
            color: hero!.image_url ? '#fff' : 'var(--sf-text, #111)',
            backgroundImage: hero!.image_url
              ? `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)), url(${hero!.image_url})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {hero!.headline && (
            <h2 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, maxWidth: 720, fontFamily: 'var(--sf-font-heading)' }}>
              {hero!.headline}
            </h2>
          )}
          {hero!.subheadline && (
            <p style={{ fontSize: '1.125rem', margin: '0.75rem 0 0', maxWidth: 640, opacity: 0.92 }}>
              {hero!.subheadline}
            </p>
          )}
          {hero!.cta_text && (
            <a
              href={hero!.cta_url || '#produkty'}
              style={{
                display: 'inline-block',
                marginTop: '1.5rem',
                padding: '0.75rem 1.75rem',
                background: 'var(--sf-accent, #111)',
                color: '#fff',
                borderRadius: 'var(--sf-radius, 6px)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {hero!.cta_text}
            </a>
          )}
        </section>
      )}
      <header
        id="produkty"
        style={{
          padding: '2rem 2rem 1rem',
          borderBottom: '1px solid var(--shopio-color-border-default)',
          background: 'var(--shopio-color-surface-2)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Link
            href="/"
            style={{
              fontSize: '0.875rem',
              color: 'var(--shopio-color-fg-muted)',
              textDecoration: 'none',
            }}
          >
            ← Shopio
          </Link>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              margin: '0.5rem 0 0.25rem',
              color: 'var(--shopio-color-fg-strong)',
            }}
          >
            {tenant.display_name}
          </h1>
          <p style={{ color: 'var(--shopio-color-fg-muted)', fontSize: '0.875rem', margin: 0 }}>
            {products.length} {products.length === 1 ? 'produkt' : 'produktů'} ·{' '}
            {tenant.country_code} · {tenant.default_currency}
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem' }}>
        <form
          method="get"
          style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', maxWidth: 480 }}
        >
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Hledat produkty…"
            style={{
              flex: 1,
              padding: '0.625rem 0.875rem',
              border: '1px solid var(--shopio-color-border-default, #ddd)',
              borderRadius: 6,
              fontSize: '0.9375rem',
              background: 'inherit',
              color: 'inherit',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.625rem 1.125rem',
              background: 'var(--sf-accent, #111)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.9375rem',
              cursor: 'pointer',
            }}
          >
            Hledat
          </button>
        </form>
        {categories.length > 0 && (
          <nav
            aria-label="Kategorie"
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}
          >
            <CategoryChip
              href={`/s/${tenantSlug}${q ? `?q=${encodeURIComponent(q)}` : ''}`}
              active={!categorySlug}
            >
              Vše
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                href={`/s/${tenantSlug}?kategorie=${encodeURIComponent(c.slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                active={categorySlug === c.slug}
              >
                {c.name}
              </CategoryChip>
            ))}
          </nav>
        )}
        {q && (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--sf-muted, #666)' }}>
            Výsledky pro „{q}" ({products.length}) ·{' '}
            <Link href={`/s/${tenantSlug}`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
              zrušit
            </Link>
          </p>
        )}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {facets.length > 0 && (
            <aside
              style={{
                flex: '0 0 220px',
                position: 'sticky',
                top: '1rem',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <strong>Filtry</strong>
                {anyFacetActive && (
                  <Link
                    href={`/s/${tenantSlug}${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                    style={{ fontSize: '0.8125rem', color: 'var(--sf-accent, #0066cc)' }}
                  >
                    zrušit
                  </Link>
                )}
              </div>
              {facets.map((f) => (
                <div key={f.name} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    {f.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {f.values.map((v) => {
                      const active = (selectedFacets[f.name] ?? []).includes(v.value);
                      return (
                        <Link
                          key={v.value}
                          href={facetHref(f.name, v.value)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 6,
                            textDecoration: 'none',
                            color: 'inherit',
                            background: active ? 'var(--sf-accent, #111)' : 'transparent',
                            border: active ? 'none' : '1px solid var(--shopio-color-border-default, rgba(128,128,128,0.25))',
                          }}
                        >
                          <span style={{ color: active ? '#fff' : 'inherit' }}>
                            {active ? '✓ ' : ''}
                            {v.value}
                          </span>
                          <span style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--sf-muted, #888)' }}>
                            {v.count}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </aside>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
        {products.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--shopio-color-fg-muted)',
            }}
          >
            <p style={{ fontSize: '1.125rem' }}>
              {q || anyFacetActive ? 'Nic neodpovídá zvoleným filtrům.' : 'Tady zatím nic není.'}
            </p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {q || anyFacetActive
                ? 'Zkuste upravit výběr.'
                : 'Storefront se naplní po publikování prvního produktu.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {products.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
              <SaveButtons
                product={{
                  id: p.id,
                  slug: p.slug,
                  title: p.title,
                  image: p.primary_image?.url ?? null,
                  priceAmount: p.base_price?.amount ?? null,
                  priceCurrency: p.base_price?.currency ?? null,
                }}
              />
              <Link
                href={`/s/${tenantSlug}/p/${p.slug}`}
                style={{
                  display: 'block',
                  background: 'var(--shopio-color-surface-2)',
                  borderRadius: 'var(--shopio-radius-lg)',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid var(--shopio-color-border-default)',
                  transition:
                    'transform var(--shopio-motion-fast), box-shadow var(--shopio-motion-fast)',
                }}
              >
                <div
                  style={{
                    aspectRatio: '1 / 1',
                    background: 'var(--shopio-color-surface-3)',
                    overflow: 'hidden',
                  }}
                >
                  {p.primary_image ? (
                    <img
                      src={p.primary_image.url}
                      alt={p.primary_image.alt ?? p.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--shopio-color-fg-muted)',
                        fontSize: '0.75rem',
                      }}
                    >
                      no image
                    </div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  {p.vendor && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--shopio-color-fg-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {p.vendor}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 500,
                      color: 'var(--shopio-color-fg-strong)',
                      marginBottom: '0.5rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {p.title}
                  </div>
                  {p.rating && p.rating.count > 0 && (
                    <div style={{ marginBottom: '0.375rem' }}>
                      <RatingBadge average={p.rating.average} count={p.rating.count} size={13} />
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--shopio-color-fg-strong)',
                    }}
                  >
                    {formatMoney(p.base_price, tenant.default_locale)}
                  </div>
                </div>
              </Link>
              </div>
            ))}
          </div>
        )}
          </div>
        </div>
      </main>
    </div>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: '0.375rem 0.875rem',
        borderRadius: 999,
        fontSize: '0.8125rem',
        textDecoration: 'none',
        border: `1px solid ${active ? 'var(--sf-accent, #111)' : 'var(--shopio-color-border-default, #ddd)'}`,
        background: active ? 'var(--sf-accent, #111)' : 'transparent',
        color: active ? '#fff' : 'inherit',
      }}
    >
      {children}
    </Link>
  );
}
