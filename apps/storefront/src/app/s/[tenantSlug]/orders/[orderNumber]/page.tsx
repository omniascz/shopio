'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getOrder,
  getOrderTracking,
  formatMoney,
  formatVatRate,
  invoicePdfUrl,
  type OrderDetail,
  type OrderTrackingShipment,
} from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string; orderNumber: string }>;
}

export default function OrderConfirmationPage({ params }: Props) {
  const { tenantSlug, orderNumber } = use(params);
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [shipments, setShipments] = useState<OrderTrackingShipment[]>([]);
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
        else {
          setOrder(o);
          const t = await getOrderTracking(tenantSlug, orderNumber, email);
          if (!cancelled) setShipments(t);
        }
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
          <Row
            label={`Mezisoučet${order.tax_included ? ' (vč. DPH)' : ''}`}
            value={formatMoney(order.totals.subtotal)}
          />
          <Row
            label={order.shipping_method ? `Doprava — ${order.shipping_method.display_name}` : 'Doprava'}
            value={
              order.totals.shipping.amount === '0'
                ? 'Zdarma'
                : formatMoney(order.totals.shipping)
            }
          />
          <Row label="Celkem" value={formatMoney(order.totals.total)} bold />
          {order.tax_breakdown.map((b) => (
            <Row
              key={b.rate_basis_points}
              label={`z toho DPH ${formatVatRate(b.rate_basis_points)}`}
              value={formatMoney({ amount: b.tax_amount, currency: order.totals.total.currency })}
              muted
            />
          ))}
          {order.tax_breakdown.length === 0 && order.totals.tax.amount !== '0' && (
            <Row label="z toho DPH" value={formatMoney(order.totals.tax)} muted />
          )}
        </div>

        {order.pickup_point && (
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#444' }}>
            <strong>Výdejní místo:</strong> {order.pickup_point.name}
            {order.pickup_point.street && `, ${order.pickup_point.street}`}
            {`, ${order.pickup_point.postal_code} ${order.pickup_point.city}`}
          </div>
        )}
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

      {shipments.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Zásilky</h2>
          {shipments.map((shp) => (
            <div key={shp.number} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>
                {shp.status === 'delivered'
                  ? '✓ Doručeno'
                  : shp.status === 'handed_over'
                    ? '🚚 Na cestě'
                    : '📦 Připravujeme'}
                {shp.tracking_number && (
                  <>
                    {' '}
                    —{' '}
                    {shp.tracking_url ? (
                      <a
                        href={shp.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0066cc' }}
                      >
                        {shp.tracking_number}
                      </a>
                    ) : (
                      shp.tracking_number
                    )}
                  </>
                )}
              </div>
              <ul
                style={{
                  margin: '0.375rem 0 0',
                  paddingLeft: '1.25rem',
                  fontSize: '0.8125rem',
                  color: '#666',
                }}
              >
                {shp.events.map((e, idx) => (
                  <li key={idx}>
                    {new Date(e.occurred_at).toLocaleString('cs-CZ')} — {e.description ?? e.status}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

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
        {order.payment_status === 'paid' && email && (
          <a
            href={invoicePdfUrl(tenantSlug, orderNumber, email)}
            style={{
              display: 'inline-block',
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: '#0066cc',
            }}
          >
            ⬇ Stáhnout fakturu (PDF)
          </a>
        )}
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

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.375rem 0',
        fontWeight: bold ? 600 : 400,
        fontSize: bold ? '1.0625rem' : muted ? '0.8125rem' : '0.9375rem',
        color: muted ? '#666' : 'inherit',
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
