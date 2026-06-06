/**
 * Coupons admin — list + create (per `10-pricing-promotions.md`).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CouponItem } from '../lib/api';

const KIND_LABELS: Record<string, string> = {
  percentage: 'Procenta',
  fixed: 'Pevná částka',
  free_shipping: 'Doprava zdarma',
};

function toMinor(value: string): string | null {
  const n = value.replace(/\s/g, '').replace(',', '.');
  if (n === '') return '0';
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const [maj, frac = ''] = n.split('.');
  return `${maj}${frac.padEnd(2, '0')}`;
}

function describeValue(c: CouponItem): string {
  if (c.kind === 'percentage') return `${Number(c.value) / 100} %`;
  if (c.kind === 'fixed') return `${(Number(c.value) / 100).toFixed(0)} ${c.currency ?? ''}`;
  return '—';
}

export function CouponsListPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.listCoupons() });
  const coupons = query.data?.coupons ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateCoupon(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Slevové kódy</h1>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>
            + Nový kód
          </button>
        )}
      </header>

      {creating && (
        <CreateForm
          onDone={() => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid #e9ecef' }}>
        {query.isLoading && <p style={{ padding: '0.5rem' }}>Načítání…</p>}
        {coupons.length === 0 && !query.isLoading && (
          <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádné slevové kódy.</p>
        )}
        {coupons.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Kód</th>
                <th style={thStyle}>Typ</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Hodnota</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Min. nákup</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Využití</th>
                <th style={thStyle}>Platí do</th>
                <th style={thStyle}>Stav</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{c.code}</td>
                  <td style={tdStyle}>{KIND_LABELS[c.kind] ?? c.kind}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{describeValue(c)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {Number(c.min_purchase_amount) > 0 ? `${(Number(c.min_purchase_amount) / 100).toFixed(0)} Kč` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {c.usage_count}
                    {c.max_uses_total != null && ` / ${c.max_uses_total}`}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem', color: '#666' }}>
                    {c.ends_at ? new Date(c.ends_at).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                  <td style={tdStyle}>{c.is_active ? '✓ aktivní' : 'neaktivní'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.is_active })}
                      style={smallBtn}
                    >
                      {c.is_active ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState('percentage');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxUsesTotal, setMaxUsesTotal] = useState('');
  const [maxPerCustomer, setMaxPerCustomer] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      // percentage value entered as % → basis points; fixed as Kč → minor units
      let v = '0';
      if (kind === 'percentage') {
        const pct = Number(value.replace(',', '.'));
        if (!pct || pct <= 0 || pct > 100) throw new Error('Procento musí být 1–100');
        v = String(Math.round(pct * 100));
      } else if (kind === 'fixed') {
        const minor = toMinor(value);
        if (!minor || minor === '0') throw new Error('Zadejte částku');
        v = minor;
      }
      return api.createCoupon({
        code,
        kind,
        value: v,
        ...(kind === 'fixed' && { currency: 'CZK' }),
        ...(minPurchase && { minPurchaseAmount: toMinor(minPurchase) ?? '0' }),
        ...(maxUsesTotal && { maxUsesTotal: Number(maxUsesTotal) }),
        ...(maxPerCustomer && { maxUsesPerCustomer: Number(maxPerCustomer) }),
        ...(endsAt && { endsAt: new Date(endsAt).toISOString() }),
      });
    },
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div style={{ background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Nový slevový kód</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <Field label="Kód">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LETO2026" style={inputStyle} />
        </Field>
        <Field label="Typ slevy">
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
            <option value="percentage">Procenta</option>
            <option value="fixed">Pevná částka (Kč)</option>
            <option value="free_shipping">Doprava zdarma</option>
          </select>
        </Field>
        {kind !== 'free_shipping' && (
          <Field label={kind === 'percentage' ? 'Sleva (%)' : 'Sleva (Kč)'}>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'percentage' ? '10' : '200'} style={inputStyle} />
          </Field>
        )}
        <Field label="Min. nákup (Kč, volitelné)">
          <input value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Max. použití celkem">
          <input type="number" value={maxUsesTotal} onChange={(e) => setMaxUsesTotal(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Max. na zákazníka">
          <input type="number" value={maxPerCustomer} onChange={(e) => setMaxPerCustomer(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Platí do (volitelné)">
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0.5rem 0' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={!code || createMutation.isPending}
          onClick={() => { setError(null); createMutation.mutate(); }}
          style={primaryBtn}
        >
          {createMutation.isPending ? 'Vytvářím…' : 'Vytvořit kód'}
        </button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '0.8125rem' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase',
  letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef',
};
const tdStyle: React.CSSProperties = { padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd',
  borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4,
  fontSize: '0.875rem', cursor: 'pointer',
};
const smallBtn: React.CSSProperties = {
  padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99',
  borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer',
};
