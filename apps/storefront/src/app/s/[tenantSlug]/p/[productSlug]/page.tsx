import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney, getProduct, getRecommendations } from '@/lib/api';
import { getStorefrontLocale } from '@/lib/locale';
import { AddToCart } from '@/components/add-to-cart';
import { SaveButtons } from '@/components/save-buttons';
import { RatingBadge } from '@/components/stars';
import { ProductReviews } from '@/components/product-reviews';
import { ProductCardRow } from '@/components/product-card-row';

interface Props {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug, productSlug } = await params;
  const product = await getProduct(tenantSlug, productSlug, await getStorefrontLocale());
  if (!product) return { title: 'Produkt nenalezen' };

  const description = product.description_html
    ? product.description_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    : undefined;
  const primary = product.media.find((m) => m.is_primary) ?? product.media[0];

  return {
    title: `${product.title} — ${product.tenant.display_name}`,
    description,
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      siteName: product.tenant.display_name,
      ...(primary && { images: [{ url: primary.url, alt: primary.alt ?? product.title }] }),
    },
  };
}

/** schema.org Product structured data — rich results in search (per `19`). */
function productJsonLd(
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>,
  tenantSlug: string,
) {
  const primary = product.media.find((m) => m.is_primary) ?? product.media[0];
  const anyInStock = product.variants.some((v) => v.in_stock);
  const prices = product.variants.map((v) => Number(v.price.amount) / 100);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    ...(primary && { image: [primary.url] }),
    ...(product.description_html && {
      description: product.description_html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }),
    ...(product.variants[0]?.sku && { sku: product.variants[0].sku }),
    ...(product.brand_name && { brand: { '@type': 'Brand', name: product.brand_name } }),
    ...(product.rating.count > 0 &&
      product.rating.average !== null && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: product.rating.average,
          reviewCount: product.rating.count,
        },
      }),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: product.variants[0]?.price.currency ?? 'CZK',
      ...(prices.length && {
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
      }),
      offerCount: product.variants.length,
      availability: anyInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `/s/${tenantSlug}/p/${product.slug}`,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { tenantSlug, productSlug } = await params;
  const product = await getProduct(tenantSlug, productSlug, await getStorefrontLocale());
  if (!product) notFound();

  const primaryMedia = product.media.find((m) => m.is_primary) ?? product.media[0];
  const otherMedia = product.media.filter((m) => m.id !== primaryMedia?.id);

  const defaultVariant = product.variants[0];
  const priceToShow = defaultVariant?.price ?? product.base_price;
  const jsonLd = productJsonLd(product, tenantSlug);

  // EU Omnibus: lowest price of the last 30 days across on-sale variants.
  const lows = product.variants
    .map((v) => v.lowest_price_30d)
    .filter((m): m is NonNullable<typeof m> => m != null);
  const lowest30 = lows.length
    ? lows.reduce((min, m) => (BigInt(m.amount) < BigInt(min.amount) ? m : min))
    : null;

  // Recommendations (P2) — "frequently bought together" + related.
  const recs = await getRecommendations(tenantSlug, productSlug);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--shopio-color-surface-1)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

            {product.rating.count > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <a href="#recenze" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <RatingBadge average={product.rating.average} count={product.rating.count} size={16} />
                </a>
              </div>
            )}

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
            {lowest30 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--shopio-color-fg-muted)', marginBottom: '1rem' }}>
                Nejnižší cena za posledních 30 dní: {formatMoney(lowest30, 'cs-CZ')}
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <AddToCart variants={product.variants} />
            </div>

            <SaveButtons
              variant="pdp"
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                image: primaryMedia?.url ?? null,
                priceAmount: priceToShow?.amount ?? null,
                priceCurrency: priceToShow?.currency ?? null,
              }}
            />

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

        {product.attributes.length > 0 && (
          <section style={{ marginTop: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem' }}>Specifikace</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 560 }}>
              <tbody>
                {product.attributes.map((a, i) => (
                  <tr
                    key={a.name + i}
                    style={{
                      background: i % 2 ? 'var(--shopio-color-surface-2, rgba(128,128,128,0.05))' : 'transparent',
                    }}
                  >
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '0.5rem 1rem 0.5rem 0.5rem',
                        fontWeight: 500,
                        color: 'var(--sf-muted, #666)',
                        width: '40%',
                        verticalAlign: 'top',
                      }}
                    >
                      {a.name}
                    </th>
                    <td style={{ padding: '0.5rem' }}>{a.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <ProductCardRow title="Často kupováno společně" tenantSlug={tenantSlug} products={recs.frequently_bought_together} />
        <ProductCardRow title="Mohlo by se vám líbit" tenantSlug={tenantSlug} products={recs.related} />

        <div id="recenze" style={{ marginTop: '2.5rem' }}>
          <ProductReviews
            tenantSlug={tenantSlug}
            productSlug={product.slug}
            rating={product.rating}
            reviews={product.reviews}
          />
        </div>
      </main>
    </div>
  );
}
