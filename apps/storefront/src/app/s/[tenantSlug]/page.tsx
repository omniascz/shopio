import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney, getProducts, getTenant } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  return {
    title: tenant ? `${tenant.display_name} — Shopio` : 'Shopio',
    description: tenant ? `Shop ${tenant.display_name} on Shopio` : undefined,
  };
}

export default async function TenantCatalogPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  const { products } = await getProducts(tenantSlug, { limit: 24 });

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
        {products.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--shopio-color-fg-muted)',
            }}
          >
            <p style={{ fontSize: '1.125rem' }}>Tady zatím nic není.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Storefront se naplní po publikování prvního produktu.
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
