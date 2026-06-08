'use client';

/**
 * Address book (P1) — saved addresses for express checkout. List + add + set
 * default + remove, in the customer account.
 */

import { useEffect, useState } from 'react';
import { addAddress, deleteAddress, listAddresses, setDefaultAddress, type SavedAddress } from '@/lib/api';

export function AddressBook({ tenantSlug }: { tenantSlug: string }) {
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [adding, setAdding] = useState(false);
  const reload = () => listAddresses(tenantSlug).then(setItems);
  useEffect(() => { void reload(); }, [tenantSlug]);

  return (
    <section style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Adresář</h2>
        {!adding && <button type="button" onClick={() => setAdding(true)} style={smallBtn}>+ Přidat adresu</button>}
      </div>
      {adding && <AddForm tenantSlug={tenantSlug} onDone={() => { setAdding(false); void reload(); }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding ? (
        <p style={{ color: 'var(--sf-muted, #666)', fontSize: '0.875rem' }}>Zatím žádné uložené adresy.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {items.map((a) => (
            <div key={a.id} style={{ border: '1px solid rgba(128,128,128,0.25)', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 600 }}>{a.label || a.recipient_name} {a.is_default && <span style={{ fontSize: '0.7rem', color: 'var(--sf-accent,#0066cc)' }}>• výchozí</span>}</div>
              <div style={{ color: 'var(--sf-muted,#666)', marginTop: 4 }}>
                {a.recipient_name}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.postal_code} {a.city}, {a.country_code}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {!a.is_default && <button type="button" onClick={() => setDefaultAddress(tenantSlug, a.id).then(reload)} style={tinyBtn}>Nastavit výchozí</button>}
                <button type="button" onClick={() => deleteAddress(tenantSlug, a.id).then(reload)} style={tinyDanger}>Smazat</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AddForm({ tenantSlug, onDone, onCancel }: { tenantSlug: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ label: '', recipientName: '', phone: '', line1: '', city: '', postalCode: '', countryCode: 'CZ' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    setBusy(true);
    await addAddress(tenantSlug, f).catch(() => null);
    setBusy(false);
    onDone();
  }
  return (
    <div style={{ border: '1px solid rgba(128,128,128,0.25)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <In label="Označení (Domů…)" v={f.label} on={(v) => set('label', v)} />
        <In label="Jméno příjemce" v={f.recipientName} on={(v) => set('recipientName', v)} />
        <In label="Ulice a č.p." v={f.line1} on={(v) => set('line1', v)} />
        <In label="Telefon" v={f.phone} on={(v) => set('phone', v)} />
        <In label="Město" v={f.city} on={(v) => set('city', v)} />
        <In label="PSČ" v={f.postalCode} on={(v) => set('postalCode', v)} />
        <In label="Země (CZ/SK…)" v={f.countryCode} on={(v) => set('countryCode', v.toUpperCase())} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button type="button" disabled={!f.recipientName || !f.line1 || !f.city || busy} onClick={submit} style={smallBtn}>Uložit</button>
        <button type="button" onClick={onCancel} style={tinyBtn}>Zrušit</button>
      </div>
    </div>
  );
}

function In({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label style={{ fontSize: '0.8125rem' }}>
      <span style={{ display: 'block', marginBottom: 3 }}>{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
    </label>
  );
}

const smallBtn: React.CSSProperties = { padding: '0.45rem 0.875rem', background: 'var(--sf-accent, #111)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8125rem', cursor: 'pointer' };
const tinyBtn: React.CSSProperties = { padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid rgba(128,128,128,0.4)', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', color: 'inherit' };
const tinyDanger: React.CSSProperties = { ...tinyBtn, color: '#c00', borderColor: '#f3b0b0' };
