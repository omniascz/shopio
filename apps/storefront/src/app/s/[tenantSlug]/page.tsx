import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney, getCategories, getProducts, getTenant } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ q?: string; kategorie?: string }>;
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

  const sp = await searchParams;
  const q = sp?.q?.trim() || undefined;
  const categorySlug = sp?.kategorie?.trim() || undefined;
  const [{ products }, categories] = await Promise.all([
    getProducts(tenantSlug, { limit: 24, ...(q && { q }), ...(categorySlug && { categorySlug }) }),
    getCategories(tenantSlug),
  ]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--shopio-color-surface-1)' }}>
      <header
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
        {products.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--shopio-color-fg-muted)',
            }}
          >
            <p style={{ fontSize: '1.125rem' }}>
              {q ? `Pro „${q}" jsme nic nenašli.` : 'Tady zatím nic není.'}
            </p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {q
                ? 'Zkuste jiný výraz.'
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
              <Link
                key={p.id}
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
            ))}
          </div>
        )}
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
