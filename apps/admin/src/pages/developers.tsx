/**
 * Vývojáři (developer platform) — API keys + outbound webhooks (per `28` MVP).
 * Secrets are shown ONCE on creation.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiKeyItem, type WebhookItem } from '../lib/api';

const PERMS = [
  { code: 'PERM-ADMIN-FULL', label: 'Plný přístup' },
  { code: 'PERM-ORDER-VIEW', label: 'Číst objednávky' },
  { code: 'PERM-ORDER-EDIT', label: 'Upravovat objednávky' },
  { code: 'PERM-PRODUCT-VIEW', label: 'Číst produkty' },
  { code: 'PERM-PRODUCT-EDIT', label: 'Upravovat produkty' },
  { code: 'PERM-PRODUCT-CREATE', label: 'Vytvářet produkty' },
];

export function DevelopersPage() {
  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1.5rem' }}>Vývojáři</h1>
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}

// ===== API keys ==============================================================

function ApiKeysSection() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'api-keys'], queryFn: () => api.listApiKeys() });
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>(['PERM-PRODUCT-VIEW']);
  const [revealed, setRevealed] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createApiKey({ name, permissions: perms }),
    onSuccess: (r) => { setRevealed(r.key); setName(''); qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] }); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] }),
  });
  const keys = query.data?.api_keys ?? [];

  return (
    <section style={card}>
      <h2 style={h2}>API klíče</h2>
      <p style={hint}>Programový přístup k API přes <code>Authorization: Bearer sk_live_…</code>. Klíč se zobrazí jen jednou.</p>

      {revealed && (
        <div style={{ background: '#e3f5e8', border: '1px solid #1c7c34', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', marginBottom: 4 }}>Zkopírujte klíč teď — už ho znovu neuvidíte:</div>
          <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{revealed}</code>
          <div><button type="button" onClick={() => setRevealed(null)} style={{ ...ghostBtn, marginTop: 6 }}>Uložil/a jsem</button></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        <input placeholder="Název klíče" value={name} onChange={(e) => setName(e.target.value)} style={input} />
        {PERMS.map((p) => (
          <label key={p.code} style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={perms.includes(p.code)} onChange={(e) => setPerms((x) => e.target.checked ? [...x, p.code] : x.filter((c) => c !== p.code))} />
            {p.label}
          </label>
        ))}
        <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !name || perms.length === 0} style={primaryBtn}>
          {create.isPending ? 'Vytvářím…' : '+ Klíč'}
        </button>
      </div>

      {keys.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {keys.map((k: ApiKeyItem) => (
              <tr key={k.id}>
                <td style={td}>{k.name} <code style={{ color: '#999', fontSize: '0.75rem' }}>{k.key_prefix}…{k.key_hint}</code></td>
                <td style={{ ...td, fontSize: '0.75rem', color: '#666' }}>{k.permissions.length} opráv.</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {k.status === 'active'
                    ? <button type="button" onClick={() => revoke.mutate(k.id)} style={{ ...ghostBtn, color: '#c0392b' }}>Zrušit</button>
                    : <span style={{ color: '#999', fontSize: '0.8125rem' }}>Zrušen</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ===== Webhooks ==============================================================

function WebhooksSection() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'webhooks'], queryFn: () => api.listWebhooks() });
  const [url, setUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const available = query.data?.available_topics ?? [];

  const create = useMutation({
    mutationFn: () => api.createWebhook({ url, topics }),
    onSuccess: (r) => { setRevealed(r.secret); setUrl(''); setTopics([]); qc.invalidateQueries({ queryKey: ['admin', 'webhooks'] }); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.setWebhookEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'webhooks'] }),
  });
  const hooks = query.data?.webhooks ?? [];

  return (
    <section style={card}>
      <h2 style={h2}>Webhooky</h2>
      <p style={hint}>Doručíme podepsané (HMAC-SHA256) eventy na váš endpoint. Tajný klíč se zobrazí jen jednou.</p>

      {revealed && (
        <div style={{ background: '#e3f5e8', border: '1px solid #1c7c34', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', marginBottom: 4 }}>Podpisový klíč (uložte teď):</div>
          <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{revealed}</code>
          <div><button type="button" onClick={() => setRevealed(null)} style={{ ...ghostBtn, marginTop: 6 }}>Uložil/a jsem</button></div>
        </div>
      )}

      <div style={{ marginBottom: '0.75rem' }}>
        <input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...input, width: 360 }} />
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
          {available.map((t) => (
            <label key={t} style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={topics.includes(t)} onChange={(e) => setTopics((x) => e.target.checked ? [...x, t] : x.filter((c) => c !== t))} />
              {t}
            </label>
          ))}
        </div>
        <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !url || topics.length === 0} style={primaryBtn}>
          {create.isPending ? 'Vytvářím…' : '+ Webhook'}
        </button>
      </div>

      {hooks.map((w: WebhookItem) => <WebhookRow key={w.id} hook={w} onToggle={(en) => toggle.mutate({ id: w.id, enabled: en })} />)}
    </section>
  );
}

function WebhookRow({ hook, onToggle }: { hook: WebhookItem; onToggle: (enabled: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const deliveries = useQuery({
    queryKey: ['admin', 'webhook-deliveries', hook.id],
    queryFn: () => api.listWebhookDeliveries(hook.id),
    enabled: open,
  });
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 6, padding: '0.625rem 0.875rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 'none', color: '#0066ff', cursor: 'pointer', padding: 0, fontWeight: 500, fontSize: '0.875rem' }}>
            {open ? '▾ ' : '▸ '}{hook.url}
          </button>
          <div style={{ color: '#999', fontSize: '0.75rem' }}>{hook.topics.join(', ')}{hook.paused && ' · ⏸ pozastaveno (chyby)'}</div>
        </div>
        <label style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={hook.enabled} onChange={(e) => onToggle(e.target.checked)} /> aktivní
        </label>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {!deliveries.data ? <span style={{ color: '#999', fontSize: '0.8125rem' }}>Načítání…</span>
            : deliveries.data.deliveries.length === 0 ? <span style={{ color: '#999', fontSize: '0.8125rem' }}>Žádná doručení.</span>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <tbody>
                  {deliveries.data.deliveries.slice(0, 15).map((d) => (
                    <tr key={d.id}>
                      <td style={tdSm}>{d.event_type}</td>
                      <td style={{ ...tdSm, color: d.status === 'delivered' ? '#1c7c34' : d.status === 'abandoned' ? '#c0392b' : '#b8860b' }}>{d.status}</td>
                      <td style={{ ...tdSm, textAlign: 'right' }}>{d.response_code ?? d.last_error ?? ''} · {d.attempts}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const h2: React.CSSProperties = { margin: '0 0 0.5rem', fontSize: '1.125rem' };
const hint: React.CSSProperties = { fontSize: '0.8125rem', color: '#666', margin: '0 0 1rem' };
const input: React.CSSProperties = { padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9375rem' };
const td: React.CSSProperties = { padding: '0.5rem 0.375rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const tdSm: React.CSSProperties = { padding: '0.2rem 0.375rem' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { padding: '0.3rem 0.75rem', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
