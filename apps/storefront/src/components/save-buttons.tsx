'use client';

/**
 * Wishlist (♥) + compare (⇄) toggle buttons for product cards and the PDP.
 */

import { useCompare, type SavedProduct } from '@/lib/compare-context';

export function SaveButtons({
  product,
  variant = 'card',
}: {
  product: SavedProduct;
  variant?: 'card' | 'pdp';
}) {
  const { toggleWishlist, toggleCompare, isWished, isCompared } = useCompare();
  const wished = isWished(product.id);
  const compared = isCompared(product.id);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (variant === 'pdp') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => toggleWishlist(product)}
          style={pdpBtn(wished)}
        >
          {wished ? '♥ Uloženo' : '♡ Přidat do oblíbených'}
        </button>
        <button type="button" onClick={() => toggleCompare(product)} style={pdpBtn(compared)}>
          {compared ? '⇄ V porovnání' : '⇄ Porovnat'}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        zIndex: 2,
      }}
    >
      <button
        type="button"
        aria-label="Oblíbené"
        title={wished ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        onClick={(e) => {
          stop(e);
          toggleWishlist(product);
        }}
        style={iconBtn(wished)}
      >
        {wished ? '♥' : '♡'}
      </button>
      <button
        type="button"
        aria-label="Porovnat"
        title={compared ? 'Odebrat z porovnání' : 'Přidat do porovnání'}
        onClick={(e) => {
          stop(e);
          toggleCompare(product);
        }}
        style={iconBtn(compared)}
      >
        ⇄
      </button>
    </div>
  );
}

function iconBtn(active: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    lineHeight: 1,
    background: active ? 'var(--sf-accent, #111)' : 'rgba(255,255,255,0.9)',
    color: active ? '#fff' : '#333',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  };
}

function pdpBtn(active: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 0.875rem',
    borderRadius: 6,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    background: active ? 'var(--sf-accent, #111)' : 'transparent',
    color: active ? '#fff' : 'inherit',
    border: `1px solid ${active ? 'var(--sf-accent, #111)' : 'rgba(128,128,128,0.4)'}`,
  };
}
