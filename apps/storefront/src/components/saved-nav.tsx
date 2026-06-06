'use client';

/**
 * Header badges linking to wishlist + compare with live counts.
 */

import Link from 'next/link';
import { useCompare } from '@/lib/compare-context';

export function SavedNav({ tenantSlug }: { tenantSlug: string }) {
  const { wishlist, compare } = useCompare();
  return (
    <span style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
      <Link href={`/s/${tenantSlug}/oblibene`} style={linkStyle} title="Oblíbené">
        ♥{wishlist.length > 0 && <Badge n={wishlist.length} />}
      </Link>
      <Link href={`/s/${tenantSlug}/porovnani`} style={linkStyle} title="Porovnání">
        ⇄{compare.length > 0 && <Badge n={compare.length} />}
      </Link>
    </span>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      style={{
        marginLeft: 3,
        background: 'var(--sf-accent, #111)',
        color: '#fff',
        borderRadius: 999,
        padding: '0 5px',
        fontSize: '0.6875rem',
        verticalAlign: 'top',
      }}
    >
      {n}
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
  fontSize: '1.05rem',
};
