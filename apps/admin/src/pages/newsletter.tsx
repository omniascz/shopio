/**
 * Newsletter admin (P3) — subscribers + campaigns (create / send).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type Tab = 'campaigns' | 'subscribers';

export function NewsletterPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Newsletter</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['campaigns', 'subscribers'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', border: tab === t ? '2px solid #0066ff' : '1px solid #ddd', background: tab === t ? '#eef4ff' : '#fff', fontWeight: tab === t ? 600 : 400 }}>
            {t === 'campaigns' ? 'Kampaně' : 'Odběratelé'}
          </button>
        ))}
      </div>
      {tab === 'campaigns' ? <Campaigns /> : <Subscribers />}
    </div>
  );
}

function Subscribers() {
  const q = useQuery({ queryKey: ['admin', 'subscribers'], queryFn: () => api.listSubscribers() });
  const subs = q.data?.subscribers ?? [];
  return (
    <div style={card}>
      <p style={{ padding: '0.5rem 0.75rem', margin: 0, fontWeight: 600 }}>Aktivních odběratelů: {q.data?.active_count ?? 0}</p>
      {subs.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>E-mail</th><th style={th}>Stav</th><th style={th}>Zdroj</th><th style={th}>Přihlášen</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.email}>
                <td style={td}>{s.email}</td>
                <td style={td}>{s.status === 'active' ? '✓ aktivní' : 'odhlášen'}</td>
                <td style={{ ...td, color: '#666', fontSize: '0.8125rem' }}>{s.source ?? '—'}</td>
                <td style={{ ...td, color: '#666', fontSize: '0.8125rem' }}>{new Date(s.created_at).toLocaleDateString('cs-CZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Campaigns() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'campaigns'], queryFn: () => api.listCampaigns() });
  const camps = q.data?.campaigns ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
  const send = useMutation({ mutationFn: (id: string) => api.sendCampaign(id), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.deleteCampaign(id), onSuccess: refresh });

  return (
    <div>
      {!creating && <button type="button" onClick={() => setCreating(true)} style={{ ...primaryBtn, marginBottom: '1rem' }}>+ Nová kampaň</button>}
      {creating && <CreateForm onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}
      <div style={card}>
        {camps.length === 0 ? <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádné kampaně.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Název</th><th style={th}>Předmět</th><th style={th}>Stav</th><th style={th}>Odesláno</th><th style={th} /></tr></thead>
            <tbody>
              {camps.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.name}</td>
                  <td style={{ ...td, color: '#666' }}>{c.subject}</td>
                  <td style={td}>{c.status === 'sent' ? '✓ odesláno' : c.status === 'sending' ? 'odesílá se' : 'koncept'}</td>
                  <td style={td}>{c.status === 'sent' ? `${c.sent_count}/${c.recipient_count}` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.status === 'draft' && (
                      <>
                        <button type="button" onClick={() => { if (confirm('Odeslat všem aktivním odběratelům?')) send.mutate(c.id); }} disabled={send.isPending} style={primaryBtn}>Odeslat</button>{' '}
                        <button type="button" onClick={() => del.mutate(c.id)} style={dangerBtn}>Smazat</button>
                      </>
                    )}
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
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.createCampaign({ name, subject, bodyHtml }),
    onSuccess: onDone,
    onError: (e) => setError((e as Error).message),
  });
  return (
    <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Nová kampaň</h2>
      <label style={lbl}><span style={lblT}>Název (interní)</span><input value={name} onChange={(e) => setName(e.target.value)} style={input} /></label>
      <label style={lbl}><span style={lblT}>Předmět e-mailu</span><input value={subject} onChange={(e) => setSubject(e.target.value)} style={input} /></label>
      <label style={lbl}><span style={lblT}>Obsah (HTML)</span><textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={6} style={{ ...input, fontFamily: 'monospace' }} placeholder="<h1>…</h1><p>…</p>" /></label>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!name || !subject || create.isPending} onClick={() => { setError(null); create.mutate(); }} style={primaryBtn}>Uložit jako koncept</button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 8, border: '1px solid #e9ecef' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef' };
const td: React.CSSProperties = { padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const lbl: React.CSSProperties = { display: 'block', marginBottom: '0.75rem' };
const lblT: React.CSSProperties = { display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.8125rem' };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
