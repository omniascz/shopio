/**
 * Automation flows admin (P3) — trigger → conditions → actions builder.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const TRIGGER_LABELS: Record<string, string> = {
  'order.placed': 'Objednávka vytvořena',
  'order.paid': 'Objednávka zaplacena',
  'order.fulfilled': 'Objednávka odeslána',
  'order.cancelled': 'Objednávka zrušena',
};
const FIELD_LABELS: Record<string, string> = {
  total: 'Celková částka (haléře)', currency: 'Měna', country: 'Země', payment_method: 'Platební metoda',
  item_count: 'Počet kusů', has_coupon: 'Má kupón (0/1)', status: 'Stav',
};
const OP_LABELS: Record<string, string> = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'obsahuje', in: 'je z (a,b)' };
const ACTION_LABELS: Record<string, string> = { add_tag: 'Přidat štítek', set_note: 'Nastavit poznámku', email_merchant: 'Poslat e-mail (mně)' };

type Cond = { field: string; op: string; value: string };
type Act = { type: string; tag?: string; note?: string; to?: string; subject?: string };

export function FlowsListPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ['admin', 'flows'], queryFn: () => api.listFlows() });
  const flows = query.data?.flows ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'flows'] });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.updateFlow(id, { isActive }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.deleteFlow(id), onSuccess: refresh });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Automatizace</h1>
        {!creating && <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>+ Nové pravidlo</button>}
      </header>
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 0 }}>
        Když nastane událost a splní se podmínky, automaticky se provedou akce (otagovat objednávku, poznámka, e-mail).
      </p>
      {creating && <CreateForm onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}

      <div style={card}>
        {flows.length === 0 ? <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádná pravidla.</p> : flows.map((f) => (
          <div key={f.id} style={{ padding: '0.875rem', borderBottom: '1px solid #f0f0f0', opacity: f.is_active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{f.name}</strong>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>spuštěno {f.run_count}×</span>
                <button type="button" onClick={() => toggle.mutate({ id: f.id, isActive: !f.is_active })} style={smallBtn}>{f.is_active ? 'Vypnout' : 'Zapnout'}</button>
                <button type="button" onClick={() => { if (confirm('Smazat?')) del.mutate(f.id); }} style={dangerBtn}>×</button>
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#555', marginTop: 4 }}>
              <b>Když:</b> {TRIGGER_LABELS[f.trigger_event] ?? f.trigger_event}
              {f.conditions.length > 0 && <> · <b>a</b> {f.conditions.map((c) => `${FIELD_LABELS[c.field] ?? c.field} ${OP_LABELS[c.op] ?? c.op} ${c.value}`).join(', ')}</>}
              {' → '}<b>akce:</b> {f.actions.map((a) => ACTION_LABELS[a.type] ?? a.type).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('order.paid');
  const [conds, setConds] = useState<Cond[]>([]);
  const [acts, setActs] = useState<Act[]>([{ type: 'add_tag', tag: '' }]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createFlow({
      name, triggerEvent: trigger,
      conditions: conds.map((c) => ({ field: c.field, op: c.op, value: /^-?\d+$/.test(c.value) ? Number(c.value) : c.value })),
      actions: acts,
    }),
    onSuccess: onDone,
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Nové pravidlo</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={lbl}><span style={lblT}>Název</span><input value={name} onChange={(e) => setName(e.target.value)} style={input} /></label>
        <label style={lbl}><span style={lblT}>Když nastane</span>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={input}>
            {Object.entries(TRIGGER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>

      <div style={lblT}>Podmínky (všechny musí platit)</div>
      {conds.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <select value={c.field} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} style={{ ...input, width: 200 }}>
            {Object.entries(FIELD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={c.op} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, op: e.target.value } : x))} style={{ ...input, width: 120 }}>
            {Object.entries(OP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input value={c.value} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="hodnota" style={{ ...input, width: 140 }} />
          <button type="button" onClick={() => setConds((p) => p.filter((_, j) => j !== i))} style={dangerBtn}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => setConds((p) => [...p, { field: 'total', op: 'gte', value: '' }])} style={smallBtn}>+ podmínka</button>

      <div style={{ ...lblT, marginTop: '0.75rem' }}>Akce</div>
      {acts.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <select value={a.type} onChange={(e) => setActs((p) => p.map((x, j) => j === i ? { type: e.target.value } : x))} style={{ ...input, width: 200 }}>
            {Object.entries(ACTION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {a.type === 'add_tag' && <input value={a.tag ?? ''} onChange={(e) => setActs((p) => p.map((x, j) => j === i ? { ...x, tag: e.target.value } : x))} placeholder="štítek (VIP)" style={{ ...input, width: 200 }} />}
          {a.type === 'set_note' && <input value={a.note ?? ''} onChange={(e) => setActs((p) => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="poznámka" style={{ ...input, width: 260 }} />}
          {a.type === 'email_merchant' && <input value={a.to ?? ''} onChange={(e) => setActs((p) => p.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} placeholder="e-mail příjemce" style={{ ...input, width: 240 }} />}
          <button type="button" onClick={() => setActs((p) => p.filter((_, j) => j !== i))} style={dangerBtn}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => setActs((p) => [...p, { type: 'add_tag', tag: '' }])} style={smallBtn}>+ akce</button>

      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!name || acts.length === 0 || create.isPending} onClick={() => { setError(null); create.mutate(); }} style={primaryBtn}>Vytvořit pravidlo</button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 8, border: '1px solid #e9ecef' };
const lbl: React.CSSProperties = { display: 'block', marginBottom: '0.5rem' };
const lblT: React.CSSProperties = { display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.8125rem' };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '0.375rem 0.6rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
