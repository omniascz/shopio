'use client';

import { useCart } from '../lib/cart-context';

export function CartButton() {
  const { itemCount, openDrawer } = useCart();
  return (
    <button
      onClick={openDrawer}
      aria-label={`Open cart (${itemCount} items)`}
      style={{
        position: 'relative',
        padding: '0.5rem 0.75rem',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: '0.875rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span aria-hidden>🛒</span>
      <span>Košík</span>
      {itemCount > 0 && (
        <span
          style={{
            background: '#111',
            color: '#fff',
            borderRadius: 999,
            padding: '0 6px',
            fontSize: '0.7rem',
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {itemCount}
        </span>
      )}
    </button>
  );
}
