'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart-context';
import { formatMoney } from '../lib/api';

export function CartDrawer() {
  const { cart, loading, error, drawerOpen, closeDrawer, update, remove, tenantSlug } = useCart();

  if (!drawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={closeDrawer}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        <header
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>
            Košík {cart && cart.item_count > 0 ? `(${cart.item_count})` : ''}
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem',
                background: '#fee',
                color: '#c00',
                borderRadius: 4,
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {loading && !cart && <p>Načítání…</p>}

          {cart && cart.items.length === 0 && (
            <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>
              Váš košík je prázdný.
            </p>
          )}

          {cart && cart.items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cart.items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  {item.primary_image_url ? (
                    <img
                      src={item.primary_image_url}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: 'cover',
                        borderRadius: 4,
                        background: '#f5f5f5',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        background: '#f5f5f5',
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                      {item.sku}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <button
                        onClick={() => void update(item.id, Math.max(0, item.quantity - 1))}
                        aria-label="Decrease quantity"
                        style={qtyBtnStyle}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => void update(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        style={qtyBtnStyle}
                      >
                        +
                      </button>
                      <button
                        onClick={() => void remove(item.id)}
                        aria-label="Remove item"
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#c00',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Odebrat
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {formatMoney(item.line_total)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <footer style={{ borderTop: '1px solid #eee', padding: '1rem 1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              <span>Mezisoučet</span>
              <span>{formatMoney(cart.subtotal)}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#666', margin: '0 0 0.75rem' }}>
              Doprava a daně se vypočítají při dokončení objednávky.
            </p>
            <Link
              href={`/s/${tenantSlug}/checkout`}
              onClick={closeDrawer}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.875rem',
                background: '#111',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              Pokračovat k pokladně
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
  lineHeight: 1,
};
