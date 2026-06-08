/**
 * Platforma (per `36`) — master-admin back-office. Visible only to platform
 * operators (the nav link is gated on GET /platform/me). Cross-tenant: list +
 * suspend/activate + set plan, plus platform totals.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlatformTenant } from '../lib/api';

const PLAN_OPTIONS = ['free', 'growth', 'scale', 'pro'];

export function PlatformPage() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['platform', 'stats'], queryFn: () => api.platformStats() });
  const tenants = useQuery({ queryKey: ['platform', 'tenants'], queryFn: () => api.platformTenants() });

  const statusMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      api.platformTenantStatus(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'tenants'] }),
  });
  const planMut = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => api.platformSetTenantPlan(id, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['platform', 'stats'] });
    },
  });

  const rows = tenants.data?.tenants ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>Platforma</h1>
      <p style={hint}>Provozní přehled všech e-shopů na platformě.</p>

      {stats.data && (
        <section style={{ ...card, display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Stat label="E-shopů" value={String(stats.data.tenants_total)} />
          <Stat label="Aktivních" value={String(stats.data.tenants_by_status.active ?? 0)} />
          <Stat label="Objednávek celkem" value={String(stats.data.orders_total)} />
          <Stat label="Odhad MRR" value={`€${stats.data.mrr_eur_estimate}`} />
        </section>
      )}

      <section style={card}>
        <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>E-shopy</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {['E-shop', 'Stav', 'Tarif', 'Produkty', 'Objednávky', 'Akce'].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <TenantRow
                  key={t.id}
                  t={t}
                  busy={statusMut.isPending || planMut.isPending}
                  onStatus={(action) => statusMut.mutate({ id: t.id, action })}
                  onPlan={(plan) => planMut.mutate({ id: t.id, plan })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TenantRow({
  t,
  busy,
  onStatus,
  onPlan,
}: {
  t: PlatformTenant;
  busy: boolean;
  onStatus: (action: 'suspend' | 'activate') => void;
  onPlan: (plan: string) => void;
}) {
  const suspended = t.status === 'suspended';
  return (
    <tr>
      <td style={td}>
        <strong>{t.display_name}</strong>
        <span style={{ color: '#999' }}> /{t.slug}</span>
      </td>
      <td style={td}>
        <span style={{ color: suspended ? '#c0392b' : '#1c7c34', fontWeight: 600 }}>{t.status}</span>
      </td>
      <td style={td}>
        <select value={t.plan} onChange={(e) => onPlan(e.target.value)} disabled={busy} style={{ padding: '0.2rem' }}>
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td style={td}>{t.products}</td>
      <td style={td}>{t.orders}</td>
      <td style={td}>
        {suspended ? (
          <button type="button" disabled={busy} onClick={() => onStatus('activate')} style={btn('#1c7c34')}>
            Aktivovat
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => onStatus('suspend')} style={btn('#c0392b')}>
            Pozastavit
          </button>
        )}
      </td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const hint: React.CSSProperties = { fontSize: '0.8125rem', color: '#666', margin: '0 0 1rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0.5rem', borderBottom: '2px solid #e9ecef', color: '#666', fontWeight: 600 };
const td: React.CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid #f0f0f0' };
function btn(color: string): React.CSSProperties {
  return { padding: '0.3rem 0.6rem', background: 'transparent', border: `1px solid ${color}`, color, borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
}
