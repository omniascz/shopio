/**
 * Currencies admin (P1) — enable presentment currencies + refresh ČNB rates.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const COMMON = ['EUR', 'PLN', 'USD', 'GBP', 'HUF', 'CZK'];

export function CurrenciesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'currencies'], queryFn: () => api.getCurrencies() });
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [fxMsg, setFxMsg] = useState<string | null>(null);

  useEffect(() => { if (q.data) setSelected(q.data.presentment); }, [q.data]);
  const base = q.data?.base ?? 'CZK';

  const save = useMutation({
    mutationFn: () => api.putCurrencies(selected),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['admin', 'currencies'] }); setTimeout(() => setSaved(false), 2000); },
  });
  const refreshFx = useMutation({
    mutationFn: () => api.refreshFx(),
    onSuccess: (r) => setFxMsg(`Kurzy aktualizovány (${r.count} měn, ${r.fixingDate})`),
    onError: () => setFxMsg('Aktualizace kurzů selhala — ČNB nedostupné.'),
  });

  const options = COMMON.filter((c) => c !== base);

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Měny</h1>
      <div style={card}>
        <p style={{ marginTop: 0, fontSize: '0.875rem', color: '#444' }}>
          Základní měna obchodu je <strong>{base}</strong> (v ní zadáváte ceny). Zde zapnete další měny, ve kterých
          si zákazník může prohlížet a nakupovat — ceny se přepočítají kurzem ČNB.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.75rem 0' }}>
          {options.map((c) => (
            <label key={c} style={{ fontSize: '0.875rem', display: 'flex', gap: 6, alignItems: 'center', border: '1px solid #ddd', borderRadius: 6, padding: '0.4rem 0.7rem', cursor: 'pointer', background: selected.includes(c) ? '#eef4ff' : '#fff' }}>
              <input type="checkbox" checked={selected.includes(c)} onChange={(e) => setSelected((p) => e.target.checked ? [...p, c] : p.filter((x) => x !== c))} />
              {c}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} style={primaryBtn}>
            {save.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit měny'}
          </button>
          <button type="button" onClick={() => { setFxMsg(null); refreshFx.mutate(); }} disabled={refreshFx.isPending} style={smallBtn}>
            {refreshFx.isPending ? 'Aktualizuji…' : 'Aktualizovat kurzy ČNB'}
          </button>
          {fxMsg && <span style={{ fontSize: '0.8125rem', color: '#555' }}>{fxMsg}</span>}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: 0, marginTop: '0.75rem' }}>
          Kurzy se aktualizují automaticky denně. Pozn.: slevové kódy, dárkové karty a kredit fungují zatím jen v základní měně.
        </p>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1.25rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.5rem 0.875rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
