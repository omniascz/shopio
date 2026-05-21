import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney } from '../lib/api';

export function DashboardPage() {
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => api.listOrders({ limit: 5, sort: 'recent' }),
  });

  const productsQuery = useQuery({
    queryKey: ['admin', 'products', 'recent'],
    queryFn: () => api.listProducts({ limit: 5 }),
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.75rem' }}>Přehled</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <StatCard
          label="Objednávek celkem"
          value={ordersQuery.data?.total?.toString() ?? '…'}
          link="/orders"
        />
        <StatCard
          label="Produktů (zobrazeno)"
          value={productsQuery.data?.count?.toString() ?? '…'}
          link="/products"
        />
      </div>

      <section style={sectionStyle}>
        <header style={sectionHeader}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Nedávné objednávky</h2>
          <Link to="/orders" style={linkStyle}>
            Vše →
          </Link>
        </header>
        {ordersQuery.isLoading && <p>Načítání…</p>}
        {ordersQuery.data && ordersQuery.data.orders.length === 0 && (
          <p style={{ color: '#666' }}>Zatím žádné objednávky.</p>
        )}
        {ordersQuery.data && ordersQuery.data.orders.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Číslo</th>
                <th style={thStyle}>Zákazník</th>
                <th style={thStyle}>Stav</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Celkem</th>
                <th style={thStyle}>Vytvořeno</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.data.orders.map((o) => (
                <tr key={o.id}>
                  <td style={tdStyle}>
                    <Link to="/orders/$orderId" params={{ orderId: o.id }} style={linkStyle}>
                      {o.number}
                    </Link>
                  </td>
                  <td style={tdStyle}>{o.customer_name ?? o.customer_email}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={o.status} />
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
      </section>
    </div>
  );
}

function StatCard({ label, value, link }: { label: string; value: string; link: string }) {
  return (
    <Link
      to={link}
      style={{
        display: 'block',
        background: '#fff',
        padding: '1.25rem',
        borderRadius: 8,
        border: '1px solid #e9ecef',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: '0.8125rem', color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{value}</div>
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending_payment: { bg: '#fff5d6', fg: '#7a5e00' },
    paid: { bg: '#d6f5e3', fg: '#0a5e2f' },
    partially_paid: { bg: '#e6f0ff', fg: '#003d99' },
    fulfilling: { bg: '#e8e0ff', fg: '#3d1a78' },
    fulfilled: { bg: '#d6e9f5', fg: '#0a4d6e' },
    cancelled: { bg: '#f5f5f5', fg: '#666' },
    refunded: { bg: '#ffe0e0', fg: '#a03030' },
  };
  const c = colors[status] ?? { bg: '#eee', fg: '#333' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.125rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
      }}
    >
      {status}
    </span>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  marginBottom: '1rem',
};

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};

const linkStyle: React.CSSProperties = {
  color: '#0066ff',
  textDecoration: 'none',
  fontWeight: 500,
};
