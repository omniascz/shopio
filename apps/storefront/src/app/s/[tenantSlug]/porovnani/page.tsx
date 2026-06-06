'use client';

/**
 * Compare page — side-by-side product columns with a merged spec table.
 * Fetches each compared product's full detail (for attributes) client-side.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompare } from '@/lib/compare-context';
import { getProduct, type ProductDetail } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

function money(amount: string | null, currency: string | null): string {
  if (!amount || !currency) return '—';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(
    Number(amount) / 100,
  );
}

export default function ComparePage({ params }: Props) {
  const { tenantSlug } = use(params);
  const { compare, toggleCompare, clearCompare } = useCompare();
  const [details, setDetails] = useState<Record<string, ProductDetail>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        compare.map(async (c) => [c.slug, await getProduct(tenantSlug, c.slug)] as const),
      );
      if (cancelled) return;
      const map: Record<string, ProductDetail> = {};
      for (const [slug, d] of entries) if (d) map[slug] = d;
      setDetails(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, compare]);

  if (compare.length === 0) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Porovnání</h1>
        <p style={{ color: 'var(--sf-muted, #666)' }}>
          Vyberte produkty tlačítkem ⇄ v katalogu (max 4).{' '}
          <Link href={`/s/${tenantSlug}`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
            Do obchodu →
          </Link>
        </p>
      </main>
    );
  }

  // Union of all attribute names across compared products, preserving order
  const attrNames: string[] = [];
  for (const c of compare) {
    for (const a of details[c.slug]?.attributes ?? []) {
      if (!attrNames.includes(a.name)) attrNames.push(a.name);
    }
  }

  function attrValue(slug: string, name: string): string {
    return details[slug]?.attributes.find((a) => a.name === name)?.value ?? '—';
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Porovnání ({compare.length})</h1>
        <button
          type="button"
          onClick={clearCompare}
          style={{ background: 'none', border: '1px solid rgba(128,128,128,0.4)', color: 'inherit', borderRadius: 6, padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8125rem' }}
        >
          Vymazat vše
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: compare.length * 200 }}>
          <thead>
            <tr>
              <th style={{ ...cell, width: 160 }} />
              {compare.map((c) => (
                <th key={c.id} style={{ ...cell, textAlign: 'center', verticalAlign: 'top' }}>
                  <div style={{ aspectRatio: '1/1', background: 'rgba(128,128,128,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
                    {c.image && (
                      <img src={c.image} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <Link href={`/s/${tenantSlug}/p/${c.slug}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem' }}>
                    {c.title}
                  </Link>
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleCompare(c)}
                      style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--sf-accent, #0066cc)', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      ✕ odebrat
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th style={{ ...cell, textAlign: 'left' }}>Cena</th>
              {compare.map((c) => (
                <td key={c.id} style={{ ...cell, textAlign: 'center', fontWeight: 600 }}>
                  {money(c.priceAmount, c.priceCurrency)}
                </td>
              ))}
            </tr>
            <tr>
              <th style={{ ...cell, textAlign: 'left' }}>Hodnocení</th>
              {compare.map((c) => {
                const r = details[c.slug]?.rating;
                return (
                  <td key={c.id} style={{ ...cell, textAlign: 'center' }}>
                    {r && r.count > 0 && r.average !== null ? `★ ${r.average.toFixed(1)} (${r.count})` : '—'}
                  </td>
                );
              })}
            </tr>
            {attrNames.map((name) => (
              <tr key={name}>
                <th style={{ ...cell, textAlign: 'left' }}>{name}</th>
                {compare.map((c) => (
                  <td key={c.id} style={{ ...cell, textAlign: 'center' }}>
                    {attrValue(c.slug, name)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const cell: React.CSSProperties = {
  border: '1px solid rgba(128,128,128,0.2)',
  padding: '0.625rem 0.75rem',
  fontSize: '0.875rem',
  verticalAlign: 'middle',
};
