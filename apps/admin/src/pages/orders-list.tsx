import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney } from '../lib/api';
import { StatusBadge } from './dashboard';

const STATUSES = [
  '',
  'pending_payment',
  'paid',
  'partially_paid',
  'fulfilling',
  'fulfilled',
  'cancelled',
  'refunded',
];

export function OrdersListPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const query = useQuery({
    queryKey: ['admin', 'orders', { status, q, offset }],
    queryFn: () => api.listOrders({ status: status || undefined, q: q || undefined, limit, offset }),
  });

  const total = query.data?.total ?? 0;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Objednávky</h1>
        <span style={{ color: '#666', fontSize: '0.875rem' }}>
          {total === 0 ? '0' : `${offset + 1}–${pageEnd} z ${total}`}
        </span>
      </header>

      <div style={filterBar}>
        <input
          type="search"
          placeholder="Hledat (číslo, e-mail, jméno)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          style={inputStyle}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          style={{ ...inputStyle, maxWidth: 220 }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'Všechny stavy'}
            </option>
          ))}
        </select>
      </div>

      <div style={cardStyle}>
        {query.isLoading && <p>Načítání…</p>}
        {query.isError && (
          <p style={{ color: '#c00' }}>Nepodařilo se načíst objednávky.</p>
        )}
        {query.data && query.data.orders.length === 0 && (
          <p style={{ color: '#666' }}>Žádné objednávky.</p>
        )}
        {query.data && query.data.orders.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Číslo</th>
                <th style={thStyle}>Zákazník</th>
                <th style={thStyle}>Stav</th>
                <th style={thStyle}>Platba</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Celkem</th>
                <th style={thStyle}>Vytvořeno</th>
              </tr>
            </thead>
            <tbody>
              {query.data.orders.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }}>
                  <td style={tdStyle}>
                    <Link to="/orders/$orderId" params={{ orderId: o.id }} style={linkStyle}>
                      {o.number}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <div>{o.customer_name ?? '—'}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#666' }}>
                      {o.customer_email}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8125rem', color: '#666' }}>
                      {o.payment_status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                    {formatMoney(o.total)}
                  </td>
                  <td style={{ ...tdStyle, color: '#666', fontSize: '0.8125rem' }}>
                    {new Date(o.placed_at).toLocaleString('cs-CZ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > limit && (
        <nav style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            style={pageBtn(offset === 0)}
          >
            ← Předchozí
          </button>
          <button
            type="button"
            disabled={pageEnd >= total}
            onClick={() => setOffset(offset + limit)}
            style={pageBtn(pageEnd >= total)}
          >
            Další →
          </button>
        </nav>
      )}
    </div>
  );
}

const filterBar: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginBottom: '1rem',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  padding: '0.5rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.75rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'top',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  flex: 1,
};

const linkStyle: React.CSSProperties = {
  color: '#0066ff',
  textDecoration: 'none',
  fontWeight: 500,
};

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: '0.875rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
