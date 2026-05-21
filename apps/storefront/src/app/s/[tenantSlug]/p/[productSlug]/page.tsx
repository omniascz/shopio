import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney, getProduct } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug, productSlug } = await params;
  const product = await getProduct(tenantSlug, productSlug);
  if (!product) return { title: 'Produkt nenalezen' };
  return {
    title: `${product.title} — ${product.tenant.display_name}`,
    description: product.description_html
      ? product.description_html.replace(/<[^>]+>/g, '').slice(0, 160)
      : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { tenantSlug, productSlug } = await params;
  const product = await getProduct(tenantSlug, productSlug);
  if (!product) notFound();

  const primaryMedia = product.media.find((m) => m.is_primary) ?? product.media[0];
  const otherMedia = product.media.filter((m) => m.id !== primaryMedia?.id);

  const defaultVariant = product.variants[0];
  const priceToShow = defaultVariant?.price ?? product.base_price;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--shopio-color-surface-1)' }}>
      <header
        style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--shopio-color-border-default)',
          background: 'var(--shopio-color-surface-2)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
          }}
        >
          <Link
            href={`/s/${tenantSlug}`}
            style={{
              fontSize: '0.875rem',
              color: 'var(--shopio-color-fg-muted)',
              textDecoration: 'none',
            }}
          >
            ← {product.tenant.display_name}
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
          }}
        >
          {/* Gallery */}
          <div>
            <div
              style={{
                aspectRatio: '1 / 1',
                background: 'var(--shopio-color-surface-2)',
                borderRadius: 'var(--shopio-radius-lg)',
                overflow: 'hidden',
                marginBottom: '1rem',
              }}
            >
              {primaryMedia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryMedia.url}
                  alt={primaryMedia.alt ?? product.title}
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
                  }}
                >
                  no image
                </div>
              )}
            </div>
            {otherMedia.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '0.5rem',
                }}
              >
                {otherMedia.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      aspectRatio: '1 / 1',
                      background: 'var(--shopio-color-surface-2)',
                      borderRadius: 'var(--shopio-radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.alt ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.vendor && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--shopio-color-fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.5rem',
                }}
              >
                {product.vendor}
              </div>
            )}
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                margin: '0 0 1.5rem',
                color: 'var(--shopio-color-fg-strong)',
                lineHeight: 1.2,
              }}
            >
              {product.title}
            </h1>

            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--shopio-color-fg-strong)',
                marginBottom: '0.25rem',
              }}
            >
              {formatMoney(priceToShow, 'cs-CZ')}
            </div>
            {product.compare_at && (
              <div
                style={{
                  fontSize: '1rem',
                  color: 'var(--shopio-color-fg-muted)',
                  textDecoration: 'line-through',
                  marginBottom: '1.5rem',
                }}
              >
                {formatMoney(product.compare_at, 'cs-CZ')}
              </div>
            )}

            {product.variants.length > 1 && (
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: '0.75rem',
                    color: 'var(--shopio-color-fg-default)',
                  }}
                >
                  Velikost
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {product.variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        padding: '0.625rem 1rem',
                        border: '1px solid var(--shopio-color-border-strong)',
                        borderRadius: 'var(--shopio-radius-md)',
                        fontSize: '0.875rem',
                        color: 'var(--shopio-color-fg-default)',
                        cursor: v.in_stock ? 'pointer' : 'not-allowed',
                        opacity: v.in_stock ? 1 : 0.5,
                        background: 'var(--shopio-color-surface-2)',
                      }}
                    >
                      {v.title}
                      {!v.in_stock && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>(vyprodáno)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!product.variants.some((v) => v.in_stock)}
              style={{
                marginTop: '1rem',
                padding: '1rem 2rem',
                background: 'var(--shopio-color-primary)',
                color: 'var(--shopio-color-fg-on-primary)',
                border: 'none',
                borderRadius: 'var(--shopio-radius-md)',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Přidat do košíku — TODO Wave 1 krok 5
            </button>

            {product.description_html && (
              <div
                style={{
                  marginTop: '2rem',
                  paddingTop: '2rem',
                  borderTop: '1px solid var(--shopio-color-border-default)',
                  color: 'var(--shopio-color-fg-default)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                }}
                // SAFE — comes from authenticated merchant; sanitized at write-time
                // (per `32-cms-content.md §RULE-CMS-003` enforcement Fáze 1 wave 2)
                dangerouslySetInnerHTML={{ __html: product.description_html }}
              />
            )}

            {product.categories.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--shopio-color-fg-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.5rem',
                  }}
                >
                  Kategorie
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {product.categories.map((c) => (
                    <span
                      key={c.slug}
                      style={{
                        padding: '0.25rem 0.625rem',
                        fontSize: '0.75rem',
                        background: 'var(--shopio-color-surface-3)',
                        borderRadius: 'var(--shopio-radius-full)',
                        color: 'var(--shopio-color-fg-default)',
                      }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
