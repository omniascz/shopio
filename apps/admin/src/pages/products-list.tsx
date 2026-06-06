import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney, productBasePrice } from '../lib/api';

const STATUSES = ['', 'draft', 'active', 'archived'];

export function ProductsListPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const query = useQuery({
    queryKey: ['admin', 'products', { status, q, offset }],
    queryFn: () =>
      api.listProducts({ status: status || undefined, q: q || undefined, limit, offset }),
  });

  const total = query.data?.count ?? 0;

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
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Produkty</h1>
        <Link
          to="/products/new"
          style={{
            padding: '0.5rem 1rem',
            background: '#0066ff',
            color: '#fff',
            borderRadius: 4,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          + Nový produkt
        </Link>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Hledat (název, slug)"
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
          style={{ ...inputStyle, flex: '0 0 auto', minWidth: 160 }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'Všechny stavy'}
            </option>
          ))}
        </select>
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
        {query.data && query.data.products.length === 0 && (
          <p style={{ color: '#666' }}>Žádné produkty.</p>
        )}
        {query.data && query.data.products.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Název</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Stav</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cena</th>
                <th style={thStyle}>Publikováno</th>
              </tr>
            </thead>
            <tbody>
              {query.data.products.map((p) => (
                <tr key={p.id}>
                  <td style={tdStyle}>
                    <Link
                      to="/products/$productId"
                      params={{ productId: p.id }}
                      style={{ fontWeight: 500, color: '#0066ff', textDecoration: 'none' }}
                    >
                      {p.title}
                    </Link>
                    {p.vendor && (
                      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{p.vendor}</div>
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      color: '#666',
                    }}
                  >
                    {p.slug}
                  </td>
                  <td style={tdStyle}>{p.status}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatMoney(productBasePrice(p))}
                  </td>
                  <td style={{ ...tdStyle, color: '#666', fontSize: '0.8125rem' }}>
                    {p.published_at ? new Date(p.published_at).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: '#666', fontSize: '0.8125rem', marginTop: '1rem' }}>Celkem: {total}.</p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  flex: 1,
};

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
