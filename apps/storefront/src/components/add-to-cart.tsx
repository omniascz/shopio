'use client';

import { useState } from 'react';
import { useCart } from '../lib/cart-context';
import type { ProductVariant } from '../lib/api';

export function AddToCart({ variants }: { variants: ProductVariant[] }) {
  const { add } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const inStock = selected?.in_stock ?? false;

  async function handleAdd() {
    if (!selected || !inStock) return;
    setPending(true);
    setErrorMsg(null);
    try {
      await add(selected.id, qty);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nepodařilo se přidat do košíku');
    } finally {
      setPending(false);
    }
  }

  if (variants.length === 0) {
    return <p style={{ color: '#999' }}>Tento produkt nemá dostupné varianty.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {variants.length > 1 && (
        <label style={{ fontSize: '0.875rem' }}>
          Varianta
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.in_stock}>
                {v.title} — {(Number(v.price.amount) / 100).toFixed(2)} {v.price.currency}
                {!v.in_stock ? ' (vyprodáno)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.875rem' }}>
          Množství
          <input
            type="number"
            min={1}
            max={
              selected?.stock_on_hand && selected.stock_on_hand > 0 ? selected.stock_on_hand : 99
            }
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            style={{
              display: 'block',
              width: 80,
              marginTop: 4,
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={!inStock || pending}
        style={{
          padding: '0.875rem 1.5rem',
          background: !inStock ? '#999' : '#111',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: '1rem',
          fontWeight: 500,
          cursor: !inStock || pending ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Přidávám…' : !inStock ? 'Vyprodáno' : 'Přidat do košíku'}
      </button>

      {errorMsg && <p style={{ color: '#c00', fontSize: '0.875rem', margin: 0 }}>{errorMsg}</p>}
    </div>
  );
}
