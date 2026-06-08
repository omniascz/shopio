/**
 * Plán a fakturace (per `37`) — current tier, usage, and tier switching.
 * Switching is unbilled in the MVP (real Stripe billing is a follow-up).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlanTier } from '../lib/api';

export function PlanPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'plan'], queryFn: () => api.getPlan() });
  const setPlan = useMutation({
    mutationFn: (code: string) => api.setPlan(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plan'] }),
  });

  if (query.isLoading || !query.data) return <p>Načítám…</p>;
  const { current_plan, plans, usage } = query.data;

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>Plán a fakturace</h1>
      <p style={hint}>
        Reálná fakturace tarifu bude doplněna — zatím lze tarif přepnout bez platby.
      </p>

      <section style={{ ...card, display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <Usage label="Produkty" used={usage.products} max={usage.max_products} />
        <Usage label="Objednávky tento měsíc" used={usage.orders_this_month} max={usage.max_orders_per_month} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {plans.map((p) => (
          <TierCard
            key={p.code}
            tier={p}
            current={p.code === current_plan}
            busy={setPlan.isPending}
            onSelect={() => setPlan.mutate(p.code)}
          />
        ))}
      </div>
    </div>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const over = max !== null && used >= max;
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
        {used}
        {max !== null ? ` / ${max}` : ' / ∞'}
      </div>
      {max !== null && (
        <div style={{ height: 6, background: '#eee', borderRadius: 3, marginTop: 4 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: over ? '#c0392b' : '#0066ff', borderRadius: 3 }} />
        </div>
      )}
    </div>
  );
}

function TierCard({
  tier,
  current,
  busy,
  onSelect,
}: {
  tier: PlanTier;
  current: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      style={{
        ...card,
        border: current ? '2px solid #0066ff' : '1px solid #e9ecef',
        marginBottom: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{tier.name}</h3>
        {current && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#0066ff' }}>AKTUÁLNÍ</span>}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
        €{tier.priceEurMonth}
        <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: '#666' }}>/měsíc</span>
      </div>
      {tier.transactionFeeBps > 0 && (
        <div style={{ fontSize: '0.75rem', color: '#666' }}>+ {tier.transactionFeeBps / 100} % z objednávky</div>
      )}
      <ul style={{ fontSize: '0.8125rem', paddingLeft: '1.1rem', margin: '0.75rem 0', color: '#444' }}>
        {tier.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button
        type="button"
        disabled={current || busy}
        onClick={onSelect}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: current ? '#f1f3f5' : '#0066ff',
          color: current ? '#999' : '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: current ? 'default' : 'pointer',
        }}
      >
        {current ? 'Aktuální tarif' : 'Vybrat'}
      </button>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const hint: React.CSSProperties = { fontSize: '0.8125rem', color: '#666', margin: '0 0 1rem' };
