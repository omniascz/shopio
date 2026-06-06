/**
 * Statistiky — merchant analytics (per `20-analytics-reporting.md` MVP).
 * KPI cards + revenue bar chart + top products + customer split.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney } from '../lib/api';

const PERIODS: { value: string; label: string }[] = [
  { value: '7d', label: '7 dní' },
  { value: '30d', label: '30 dní' },
  { value: '90d', label: '90 dní' },
];

export function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const query = useQuery({
    queryKey: ['admin', 'analytics', period],
    queryFn: () => api.getAnalytics(period),
  });
  const d = query.data;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Statistiky</h1>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: 999,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                border: period === p.value ? '2px solid #0066ff' : '1px solid #ddd',
                background: period === p.value ? '#eef4ff' : '#fff',
                fontWeight: period === p.value ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {query.isLoading && <p>Načítání…</p>}
      {d && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <Kpi label="Tržby (zaplacené)" value={formatMoney(d.totals.revenue)} />
            <Kpi label="Objednávky" value={String(d.totals.orders)} />
            <Kpi label="Prům. hodnota objednávky" value={formatMoney(d.totals.average_order_value)} />
            <Kpi
              label="Vráceno"
              value={formatMoney(d.refunds.amount)}
              sub={`${d.refunds.count} vratek`}
            />
            <Kpi
              label="Zákazníci"
              value={`${d.customers.new} nových`}
              sub={`${d.customers.returning} vracejících se`}
            />
          </div>

          <section style={card}>
            <h2 style={h2}>Tržby v čase</h2>
            <RevenueChart series={d.revenue_series} currency={d.currency} />
          </section>

          {d.by_channel && d.by_channel.length > 0 && (
            <section style={card}>
              <h2 style={h2}>Tržby podle kanálu</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Kanál</th>
                    <th style={{ ...th, textAlign: 'right' }}>Objednávky</th>
                    <th style={{ ...th, textAlign: 'right' }}>Tržby</th>
                  </tr>
                </thead>
                <tbody>
                  {d.by_channel.map((c, i) => (
                    <tr key={i}>
                      <td style={td}>{c.name}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.orders}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>
                        {formatMoney(c.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section style={card}>
            <h2 style={h2}>Nejprodávanější produkty</h2>
            {d.top_products.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Zatím žádné prodeje.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Produkt</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ks</th>
                    <th style={{ ...th, textAlign: 'right' }}>Tržby</th>
                  </tr>
                </thead>
                <tbody>
                  {d.top_products.map((p, i) => (
                    <tr key={i}>
                      <td style={td}>{p.title}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{p.units}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>
                        {formatMoney(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RevenueChart({
  series,
  currency,
}: {
  series: { day: string; revenue: string; orders: number }[];
  currency: string;
}) {
  if (series.length === 0) {
    return <p style={{ color: '#666', fontSize: '0.875rem' }}>Žádná data za zvolené období.</p>;
  }
  const max = Math.max(...series.map((s) => Number(s.revenue)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, overflowX: 'auto' }}>
      {series.map((s) => {
        const h = Math.max(2, Math.round((Number(s.revenue) / max) * 180));
        return (
          <div
            key={s.day}
            title={`${s.day}: ${formatMoney({ amount: s.revenue, currency })} · ${s.orders} obj.`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 24, flex: '1 0 auto' }}
          >
            <div
              style={{
                width: '70%',
                height: h,
                background: '#0066ff',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.2s',
              }}
            />
            <span style={{ fontSize: '0.625rem', color: '#999', marginTop: 4, whiteSpace: 'nowrap' }}>
              {s.day.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <div style={{ fontSize: '0.8125rem', color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  marginBottom: '1rem',
};
const h2: React.CSSProperties = { margin: '0 0 1rem', fontSize: '1rem' };
const th: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase',
  letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef',
};
const td: React.CSSProperties = { padding: '0.625rem 0.5rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
