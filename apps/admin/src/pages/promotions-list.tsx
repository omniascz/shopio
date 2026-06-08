/**
 * Promotions admin (P2) — automatic discounts + BOGO. List + create + toggle.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PromotionItem } from '../lib/api';

const KIND_LABELS: Record<string, string> = {
  order_percentage: 'Sleva % z objednávky',
  order_fixed: 'Pevná sleva',
  free_shipping: 'Doprava zdarma',
  bogo: 'BOGO (kup X získej Y)',
};

function toMinor(v: string): string {
  const n = v.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return '0';
  const [maj, frac = ''] = n.split('.');
  return `${maj}${frac.padEnd(2, '0')}`;
}

function describe(p: PromotionItem): string {
  if (p.kind === 'order_percentage') return `${Number(p.value) / 100} %`;
  if (p.kind === 'order_fixed') return `${(Number(p.value) / 100).toFixed(0)} Kč`;
  if (p.kind === 'free_shipping') return 'doprava zdarma';
  if (p.kind === 'bogo') return `kup ${p.buy_quantity} získej ${p.get_quantity} (${p.get_discount_bps === 10000 ? 'zdarma' : `${p.get_discount_bps / 100}%`})`;
  return '—';
}

export function PromotionsListPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ['admin', 'promotions'], queryFn: () => api.listPromotions() });
  const promos = query.data?.promotions ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.updatePromotion(id, { isActive }),
    onSuccess: refresh,
  });
  const del = useMutation({ mutationFn: (id: string) => api.deletePromotion(id), onSuccess: refresh });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Automatické slevy</h1>
        {!creating && <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>+ Nová akce</button>}
      </header>
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 0 }}>
        Slevy bez kódu — aplikují se samy, když košík splní podmínky. Sčítají se s kupóny.
      </p>
      {creating && <CreateForm onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}

      <div style={card}>
        {query.isLoading && <p style={{ padding: '0.5rem' }}>Načítání…</p>}
        {promos.length === 0 && !query.isLoading && <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádné akce.</p>}
        {promos.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Název</th><th style={th}>Typ</th><th style={th}>Sleva</th><th style={th}>Podmínka</th><th style={th}>Stav</th><th style={th} /></tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{KIND_LABELS[p.kind]}</td>
                  <td style={td}>{describe(p)}</td>
                  <td style={{ ...td, fontSize: '0.8125rem', color: '#666' }}>
                    {Number(p.min_subtotal) > 0 ? `od ${(Number(p.min_subtotal) / 100).toFixed(0)} Kč` : ''}
                    {p.min_quantity > 0 ? ` ${p.min_quantity}+ ks` : ''}
                    {!p.stackable ? ' • nekombinovatelné' : ''}
                  </td>
                  <td style={td}>{p.is_active ? '✓ aktivní' : 'neaktivní'}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => toggle.mutate({ id: p.id, isActive: !p.is_active })} style={smallBtn}>
                      {p.is_active ? 'Vypnout' : 'Zapnout'}
                    </button>{' '}
                    <button type="button" onClick={() => { if (confirm('Smazat akci?')) del.mutate(p.id); }} style={dangerBtn}>Smazat</button>
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
  const [name, setName] = useState('');
  const [kind, setKind] = useState('order_percentage');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [buyQ, setBuyQ] = useState('2');
  const [getQ, setGetQ] = useState('1');
  const [getPct, setGetPct] = useState('100');
  const [stackable, setStackable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name, kind, stackable };
      if (kind === 'order_percentage') {
        const pct = Number(value.replace(',', '.'));
        if (!pct || pct <= 0 || pct > 100) throw new Error('Procento 1–100');
        body.value = String(Math.round(pct * 100));
      } else if (kind === 'order_fixed') {
        body.value = toMinor(value);
        body.currency = 'CZK';
      } else if (kind === 'bogo') {
        body.buyQuantity = Number(buyQ);
        body.getQuantity = Number(getQ);
        body.getDiscountBps = Math.round(Number(getPct) * 100);
      }
      if (minSubtotal) body.minSubtotal = toMinor(minSubtotal);
      if (minQuantity) body.minQuantity = Number(minQuantity);
      return api.createPromotion(body);
    },
    onSuccess: onDone,
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Nová automatická akce</h2>
      <div style={grid3}>
        <Field label="Název"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Letní výprodej" style={input} /></Field>
        <Field label="Typ">
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        {kind === 'order_percentage' && <Field label="Sleva (%)"><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="10" style={input} /></Field>}
        {kind === 'order_fixed' && <Field label="Sleva (Kč)"><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="200" style={input} /></Field>}
        {kind === 'bogo' && <>
          <Field label="Kup (ks)"><input value={buyQ} onChange={(e) => setBuyQ(e.target.value)} type="number" min="1" style={input} /></Field>
          <Field label="Získej (ks)"><input value={getQ} onChange={(e) => setGetQ(e.target.value)} type="number" min="1" style={input} /></Field>
          <Field label="Sleva na získané (%)"><input value={getPct} onChange={(e) => setGetPct(e.target.value)} type="number" min="0" max="100" style={input} /></Field>
        </>}
        <Field label="Min. nákup (Kč, volitelné)"><input value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} style={input} /></Field>
        <Field label="Min. počet kusů (volitelné)"><input value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} type="number" style={input} /></Field>
      </div>
      <label style={{ display: 'block', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
        <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} /> Kombinovatelné s jinými akcemi
      </label>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!name || create.isPending} onClick={() => { setError(null); create.mutate(); }} style={primaryBtn}>
          {create.isPending ? 'Vytvářím…' : 'Vytvořit'}
        </button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '0.8125rem' }}><span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>{children}</label>;
}
const card: React.CSSProperties = { background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid #e9ecef' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef' };
const td: React.CSSProperties = { padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
