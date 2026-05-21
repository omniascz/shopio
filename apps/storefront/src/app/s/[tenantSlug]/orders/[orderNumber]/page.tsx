'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOrder, formatMoney, type OrderDetail } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string; orderNumber: string }>;
}

export default function OrderConfirmationPage({ params }: Props) {
  const { tenantSlug, orderNumber } = use(params);
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundErr, setNotFoundErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!email) {
      setNotFoundErr(true);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const o = await getOrder(tenantSlug, orderNumber, email);
        if (cancelled) return;
        if (!o) setNotFoundErr(true);
        else setOrder(o);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, orderNumber, email]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <p>Načítání objednávky…</p>
      </main>
    );
  }

  if (notFoundErr || !order) {
    return (
      <main style={pageStyle}>
        <h1>Objednávka nenalezena</h1>
        <p>Zkontrolujte odkaz nebo e-mail s potvrzením.</p>
        <Link href={`/s/${tenantSlug}`} style={{ color: '#0066cc' }}>
          ← Zpět do obchodu
        </Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div
        style={{
          padding: '1.5rem',
          background: '#e8f5e9',
          borderRadius: 8,
          marginBottom: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }} aria-hidden>
          ✓
        </div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Děkujeme za nákup!</h1>
        <p style={{ margin: 0, color: '#444' }}>
          Vaše objednávka <strong>{order.number}</strong> byla přijata.
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#666' }}>
          Potvrzení posíláme na <strong>{order.customer_email}</strong>.
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#888' }}>
          (MVP režim — e-mail se ještě neposílá, status: {order.status})
        </p>
      </div>

      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Položky</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {order.items.map((it) => (
            <li
              key={it.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{it.product_title}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  {it.variant_title}
                  {it.sku && ` · ${it.sku}`}
                  {' · '}× {it.quantity}
                </div>
              </div>
              <div style={{ fontWeight: 500 }}>{formatMoney(it.line_total)}</div>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: '1rem', borderTop: '2px solid #111', paddingTop: '0.75rem' }}>
          <Row label="Mezisoučet" value={formatMoney(order.totals.subtotal)} />
          <Row label="Doprava" value={formatMoney(order.totals.shipping)} />
          <Row label="Daň" value={formatMoney(order.totals.tax)} />
          <Row label="Celkem" value={formatMoney(order.totals.total)} bold />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Doručovací adresa</h2>
        <address style={{ fontStyle: 'normal', fontSize: '0.9375rem', lineHeight: 1.5 }}>
          {order.customer_name}
          <br />
          {order.shipping_address.line1}
          <br />
          {order.shipping_address.line2 && (
            <>
              {order.shipping_address.line2}
              <br />
            </>
          )}
          {order.shipping_address.postalCode} {order.shipping_address.city}
          <br />
          {order.shipping_address.countryCode}
        </address>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Stav objednávky</h2>
        <dl style={{ margin: 0, fontSize: '0.9375rem' }}>
          <dt style={dtStyle}>Číslo</dt>
          <dd style={ddStyle}>{order.number}</dd>
          <dt style={dtStyle}>Stav</dt>
          <dd style={ddStyle}>{order.status}</dd>
          <dt style={dtStyle}>Stav platby</dt>
          <dd style={ddStyle}>
            {order.payment_status} ({order.payment_method})
          </dd>
          <dt style={dtStyle}>Vytvořeno</dt>
          <dd style={ddStyle}>{new Date(order.placed_at).toLocaleString('cs-CZ')}</dd>
        </dl>
      </section>

      <Link
        href={`/s/${tenantSlug}`}
        style={{
          display: 'inline-block',
          marginTop: '1.5rem',
          padding: '0.75rem 1.5rem',
          background: '#fff',
          border: '1px solid #111',
          color: '#111',
          textDecoration: 'none',
          borderRadius: 4,
        }}
      >
        Pokračovat v nakupování
      </Link>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.375rem 0',
        fontWeight: bold ? 600 : 400,
        fontSize: bold ? '1.0625rem' : '0.9375rem',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '2rem',
};

const sectionStyle: React.CSSProperties = {
  padding: '1.5rem',
  border: '1px solid #eee',
  borderRadius: 8,
  marginBottom: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 600,
};

const dtStyle: React.CSSProperties = {
  fontWeight: 500,
  marginTop: '0.5rem',
};

const ddStyle: React.CSSProperties = {
  margin: '0 0 0 0',
  color: '#444',
};
