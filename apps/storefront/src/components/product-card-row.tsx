import Link from 'next/link';
import { formatMoney, type RecCard } from '@/lib/api';

/** A horizontal row of product cards (recommendations, collections). */
export function ProductCardRow({
  title,
  tenantSlug,
  products,
}: {
  title?: string;
  tenantSlug: string;
  products: RecCard[];
}) {
  if (products.length === 0) return null;
  return (
    <section style={{ marginTop: '2.5rem' }}>
      {title && (
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--shopio-color-fg-strong)' }}>
          {title}
        </h2>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/s/${tenantSlug}/p/${p.slug}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid var(--shopio-color-border-default)',
              borderRadius: 'var(--shopio-radius-md, 8px)',
              overflow: 'hidden',
              background: 'var(--shopio-color-surface-1)',
              display: 'block',
            }}
          >
            <div style={{ aspectRatio: '1', background: 'var(--shopio-color-surface-2, #f4f4f5)' }}>
              {p.primary_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.primary_image.url} alt={p.primary_image.alt ?? p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ padding: '0.625rem' }}>
              <div style={{ fontSize: '0.875rem', lineHeight: 1.3, marginBottom: '0.25rem' }}>{p.title}</div>
              {p.base_price && (
                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{formatMoney(p.base_price, 'cs-CZ')}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
