/**
 * Returns queue — global RMA list across orders (per `17` FLOW-RTN-002).
 * Customers create RMAs through the self-service portal; this is where the
 * merchant discovers and processes them (detail actions live on the order).
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney } from '../lib/api';

const STATUSES = ['', 'requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'];

const STATUS_LABELS: Record<string, string> = {
  requested: 'Požadováno',
  approved: 'Schváleno',
  received: 'Přijato',
  refunded: 'Refundováno',
  rejected: 'Zamítnuto',
  cancelled: 'Zrušeno',
};

export function ReturnsListPage() {
  const [status, setStatus] = useState('requested');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const query = useQuery({
    queryKey: ['admin', 'returns', { status, offset }],
    queryFn: () => api.listReturns({ status: status || undefined, limit, offset }),
  });

  const total = query.data?.total ?? 0;

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
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Vratky</h1>
        {query.data && query.data.action_needed > 0 && (
          <span
            style={{
              background: '#fff3e0',
              border: '1px solid #ffcc80',
              color: '#a65f00',
              borderRadius: 999,
              padding: '0.25rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            {query.data.action_needed} čeká na akci
          </span>
        )}
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setOffset(0);
            }}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: 999,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              border: status === s ? '2px solid #0066ff' : '1px solid #ddd',
              background: status === s ? '#eef4ff' : '#fff',
              fontWeight: status === s ? 600 : 400,
            }}
          >
            {s ? (STATUS_LABELS[s] ?? s) : 'Vše'}
          </button>
        ))}
      </div>

      <div
        style={{
          background: '#fff',
          padding: '0.5rem',
          borderRadius: 8,
          border: '1px solid #e9ecef',
        }}
      >
        {query.isLoading && <p>Načítání…</p>}
        {query.data && query.data.returns.length === 0 && (
          <p style={{ color: '#666', padding: '0.5rem' }}>Žádné vratky v tomto stavu.</p>
        )}
        {query.data && query.data.returns.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>RMA</th>
                <th style={thStyle}>Objednávka</th>
                <th style={thStyle}>Zákazník</th>
                <th style={thStyle}>Důvod</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Částka</th>
                <th style={thStyle}>Stav</th>
                <th style={thStyle}>Požádáno</th>
              </tr>
            </thead>
            <tbody>
              {query.data.returns.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: r.order.id }}
                      style={{ fontWeight: 500, color: '#0066ff', textDecoration: 'none' }}
                    >
                      {r.number}
                    </Link>
                    {r.customer_note && (
                      <div style={{ fontSize: '0.75rem', color: '#666', maxWidth: 240 }}>
                        „{r.customer_note}"
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{r.order.number}</td>
                  <td style={tdStyle}>
                    <div>{r.order.customer_name ?? '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                      {r.order.customer_email}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem' }}>{r.reason_code}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                    {formatMoney(r.actual_refund ?? r.requested_refund)}
                  </td>
                  <td style={tdStyle}>{STATUS_LABELS[r.status] ?? r.status}</td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem', color: '#666' }}>
                    {new Date(r.requested_at).toLocaleString('cs-CZ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
          style={pagerBtn}
        >
          ← Předchozí
        </button>
        <button
          type="button"
          disabled={offset + limit >= total}
          onClick={() => setOffset(offset + limit)}
          style={pagerBtn}
        >
          Další →
        </button>
        <span style={{ color: '#666', fontSize: '0.8125rem' }}>Celkem: {total}</span>
      </div>
    </div>
  );
}

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
};

const pagerBtn: React.CSSProperties = {
  padding: '0.375rem 0.875rem',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
