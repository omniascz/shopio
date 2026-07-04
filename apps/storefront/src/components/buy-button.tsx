'use client';

/**
 * Direct-buy button for the `buy_button` page-builder block (per `32`) — adds a
 * product's default variant to the cart straight from a landing/CMS page
 * (PageFlow-style "Do košíku"). Opens the cart drawer on success via useCart.
 */

import { useState } from 'react';
import { useCart } from '../lib/cart-context';

export function BuyButton({
  variantId,
  label,
  inStock,
  align = 'center',
}: {
  variantId: string | null;
  label: string;
  inStock: boolean;
  align?: 'left' | 'center' | 'right';
}) {
  const { add } = useCart();
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disabled = !variantId || !inStock || pending;

  async function handleAdd() {
    if (!variantId || !inStock) return;
    setPending(true);
    setErrorMsg(null);
    try {
      await add(variantId, 1);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nepodařilo se přidat do košíku');
    } finally {
      setPending(false);
    }
  }

  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: justify, gap: '0.35rem' }}>
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={disabled}
        style={{
          padding: '0.75rem 1.75rem',
          background: !inStock ? '#999' : 'var(--sf-accent, #111)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--sf-radius, 6px)',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Přidávám…' : !inStock ? 'Vyprodáno' : label}
      </button>
      {errorMsg && <span style={{ color: '#c00', fontSize: '0.8125rem' }}>{errorMsg}</span>}
    </div>
  );
}
