/**
 * Gift cards admin — issue (code shown once), list, top up, revoke, check
 * balance (per `10-pricing-promotions.md` §7.5).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type GiftCardItem } from '../lib/api';

const STATUS_LABELS: Record<string, string> = {
  active: '✓ aktivní',
  spent: 'vyčerpaná',
  expired: 'expirovaná',
  revoked: 'zrušená',
  pending_activation: 'čeká na aktivaci',
};

function toMinor(value: string): string | null {
  const n = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const [maj, frac = ''] = n.split('.');
  return `${maj}${frac.padEnd(2, '0')}`;
}

function money(minor: string, currency: string): string {
  return `${(Number(minor) / 100).toFixed(2)} ${currency}`;
}

export function GiftCardsListPage() {
  const queryClient = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['admin', 'gift-cards'], queryFn: () => api.listGiftCards() });
  const cards = query.data?.gift_cards ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'gift-cards'] });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Dárkové karty</h1>
        {!issuing && (
          <button type="button" onClick={() => { setIssuing(true); setIssuedCode(null); }} style={primaryBtn}>
            + Vydat kartu
          </button>
        )}
      </header>

      {issuedCode && (
        <div style={{ background: '#e7f7ec', border: '1px solid #b6e3c5', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Karta vydána — kód zobrazíme jen jednou:</p>
          <code style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em' }}>{issuedCode}</code>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#555' }}>
            Zkopírujte a předejte zákazníkovi. Později už kód nepůjde zobrazit (uchováváme jen hash).
          </p>
        </div>
      )}

      {issuing && (
        <IssueForm
          onDone={(code) => { setIssuing(false); setIssuedCode(code); refresh(); }}
          onCancel={() => setIssuing(false)}
        />
      )}

      <CheckBalance />

      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid #e9ecef', marginTop: '1rem' }}>
        {query.isLoading && <p style={{ padding: '0.5rem' }}>Načítání…</p>}
        {cards.length === 0 && !query.isLoading && (
          <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádné dárkové karty.</p>
        )}
        {cards.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Kód</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Zůstatek</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Původní</th>
                <th style={thStyle}>Příjemce</th>
                <th style={thStyle}>Platí do</th>
                <th style={thStyle}>Stav</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => <Row key={c.id} card={c} onChange={refresh} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ card, onChange }: { card: GiftCardItem; onChange: () => void }) {
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupVal, setTopupVal] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const topup = useMutation({
    mutationFn: () => {
      const minor = toMinor(topupVal);
      if (!minor || minor === '0') throw new Error('Zadejte částku');
      return api.topupGiftCard(card.id, minor);
    },
    onSuccess: () => { setTopupOpen(false); setTopupVal(''); onChange(); },
    onError: (e) => setErr((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: () => api.revokeGiftCard(card.id),
    onSuccess: onChange,
  });

  return (
    <tr style={{ opacity: card.status === 'active' ? 1 : 0.55 }}>
      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{card.code_masked}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{money(card.balance, card.currency)}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: '#888' }}>{money(card.initial_amount, card.currency)}</td>
      <td style={{ ...tdStyle, fontSize: '0.8125rem' }}>{card.issued_to_email ?? '—'}</td>
      <td style={{ ...tdStyle, fontSize: '0.8125rem', color: '#666' }}>
        {card.expires_at ? new Date(card.expires_at).toLocaleDateString('cs-CZ') : '—'}
      </td>
      <td style={tdStyle}>{STATUS_LABELS[card.status] ?? card.status}</td>
      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {card.status !== 'revoked' && (
          <>
            {topupOpen ? (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <input value={topupVal} onChange={(e) => setTopupVal(e.target.value)} placeholder="Kč" style={{ ...inputStyle, width: 70, padding: '0.25rem 0.4rem' }} />
                <button type="button" onClick={() => { setErr(null); topup.mutate(); }} style={smallBtn}>OK</button>
                <button type="button" onClick={() => setTopupOpen(false)} style={smallBtn}>×</button>
              </span>
            ) : (
              <button type="button" onClick={() => setTopupOpen(true)} style={smallBtn}>Dobít</button>
            )}{' '}
            <button type="button" onClick={() => { if (confirm('Zrušit kartu? Zůstatek propadne.')) revoke.mutate(); }} style={dangerBtn}>
              Zrušit
            </button>
          </>
        )}
        {err && topupOpen && <div style={{ color: '#c00', fontSize: '0.7rem' }}>{err}</div>}
      </td>
    </tr>
  );
}

function IssueForm({ onDone, onCancel }: { onDone: (code: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CZK');
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: () => {
      const minor = toMinor(amount);
      if (!minor || minor === '0') throw new Error('Zadejte částku');
      return api.issueGiftCard({
        amount: minor,
        currency,
        ...(email && { issuedToEmail: email }),
        ...(expiresAt && { expiresAt: new Date(expiresAt).toISOString() }),
        ...(notes && { notes }),
      });
    },
    onSuccess: (r) => onDone(r.code),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div style={{ background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Vydat dárkovou kartu</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <Field label="Hodnota">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" style={inputStyle} />
        </Field>
        <Field label="Měna">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
            <option>CZK</option><option>EUR</option><option>PLN</option><option>GBP</option>
          </select>
        </Field>
        <Field label="E-mail příjemce (volitelné)">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="zakaznik@email.cz" style={inputStyle} />
        </Field>
        <Field label="Platí do (volitelné)">
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Poznámka (volitelné)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0.5rem 0' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!amount || issue.isPending} onClick={() => { setError(null); issue.mutate(); }} style={primaryBtn}>
          {issue.isPending ? 'Vydávám…' : 'Vydat kartu'}
        </button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

function CheckBalance() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: () => api.checkGiftCardBalance(code),
    onSuccess: (r) => setResult(`${r.masked}: ${money(r.balance, r.currency)} (${STATUS_LABELS[r.status] ?? r.status})`),
    onError: () => setResult('Karta nenalezena nebo neplatná.'),
  });
  return (
    <div style={{ background: '#f8f9fb', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #e9ecef', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Ověřit zůstatek:</span>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" style={{ ...inputStyle, width: 220, fontFamily: 'monospace' }} />
      <button type="button" disabled={code.length < 4 || check.isPending} onClick={() => { setResult(null); check.mutate(); }} style={smallBtn}>Ověřit</button>
      {result && <span style={{ fontSize: '0.8125rem', color: '#333' }}>{result}</span>}
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
const dangerBtn: React.CSSProperties = {
  padding: '0.375rem 0.75rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000',
  borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer',
};
