'use client';

import { use } from 'react';
import Link from 'next/link';
import { useCompare } from '@/lib/compare-context';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

function money(amount: string | null, currency: string | null): string {
  if (!amount || !currency) return '';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(
    Number(amount) / 100,
  );
}

export default function WishlistPage({ params }: Props) {
  const { tenantSlug } = use(params);
  const { wishlist, toggleWishlist } = useCompare();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1.5rem' }}>Oblíbené ({wishlist.length})</h1>
      {wishlist.length === 0 ? (
        <p style={{ color: 'var(--sf-muted, #666)' }}>
          Zatím nic. Označte produkty srdíčkem ♡ v katalogu.{' '}
          <Link href={`/s/${tenantSlug}`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
            Do obchodu →
          </Link>
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {wishlist.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <Link
                href={`/s/${tenantSlug}/p/${p.slug}`}
                style={{
                  display: 'block',
                  border: '1px solid rgba(128,128,128,0.25)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ aspectRatio: '1/1', background: 'rgba(128,128,128,0.08)' }}>
                  {p.image && (
                    <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontWeight: 600 }}>{money(p.priceAmount, p.priceCurrency)}</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => toggleWishlist(p)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--sf-accent, #111)',
                  color: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
                title="Odebrat"
              >
                ♥
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
