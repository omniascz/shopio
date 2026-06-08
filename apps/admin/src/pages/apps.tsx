/**
 * Apps & marketplace (per `28-developer-platform.md`) — three sections:
 *  - Installed: apps this shop authorized (uninstall = revoke tokens)
 *  - Marketplace: available apps to install (OAuth consent happens in the app's
 *    own flow; here it's a directory)
 *  - My apps: register an OAuth app as a developer (client secret shown once)
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function AppsPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.75rem' }}>Aplikace</h1>
      <InstalledSection />
      <MarketplaceSection />
      <MyAppsSection />
    </div>
  );
}

function InstalledSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'apps', 'installed'], queryFn: () => api.listInstalledApps() });
  const installed = query.data?.installed ?? [];
  const uninstall = useMutation({
    mutationFn: (id: string) => api.uninstallApp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'apps', 'installed'] }),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeader}>Nainstalované aplikace</h2>
      {installed.length === 0 ? (
        <p style={muted}>Zatím nemáte nainstalované žádné aplikace.</p>
      ) : (
        <table style={tableStyle}>
          <thead><tr><th style={th}>Aplikace</th><th style={th}>Oprávnění</th><th style={th}>Instalováno</th><th style={th} /></tr></thead>
          <tbody>
            {installed.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.name}</td>
                <td style={{ ...td, fontSize: '0.75rem', color: '#555' }}>{a.scopes.join(', ')}</td>
                <td style={{ ...td, fontSize: '0.8125rem', color: '#666' }}>{new Date(a.installed_at).toLocaleDateString('cs-CZ')}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button type="button" onClick={() => { if (confirm('Odinstalovat? Přístupové tokeny budou zneplatněny.')) uninstall.mutate(a.id); }} style={dangerBtn}>
                    Odinstalovat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function MarketplaceSection() {
  const query = useQuery({ queryKey: ['admin', 'apps', 'marketplace'], queryFn: () => api.listMarketplaceApps() });
  const apps = query.data?.apps ?? [];
  return (
    <section style={cardStyle}>
      <h2 style={sectionHeader}>Marketplace</h2>
      {apps.length === 0 ? (
        <p style={muted}>Žádné dostupné aplikace.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {apps.map((a) => (
            <div key={a.id} style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: '0.875rem' }}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: '0.8125rem', color: '#666', margin: '0.25rem 0 0.5rem', minHeight: 32 }}>{a.description ?? ''}</div>
              <div style={{ fontSize: '0.7rem', color: '#888' }}>Oprávnění: {a.scopes.join(', ')}</div>
              {a.website_url && (
                <a href={a.website_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#0066ff' }}>
                  Instalovat / web aplikace →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ ...muted, marginTop: '0.75rem' }}>
        Instalace probíhá ve flow aplikace (přesměruje vás na souhlas s oprávněními). Nainstalované se objeví nahoře.
      </p>
    </section>
  );
}

function MyAppsSection() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const query = useQuery({ queryKey: ['admin', 'oauth', 'my-apps'], queryFn: () => api.listMyOAuthApps() });
  const apps = query.data?.apps ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'oauth', 'my-apps'] });
  const del = useMutation({ mutationFn: (id: string) => api.deleteOAuthApp(id), onSuccess: refresh });

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ ...sectionHeader, margin: 0 }}>Moje aplikace (vývojář)</h2>
        {!creating && <button type="button" onClick={() => { setCreating(true); setSecret(null); }} style={primaryBtn}>+ Registrovat aplikaci</button>}
      </div>

      {secret && (
        <div style={{ background: '#e7f7ec', border: '1px solid #b6e3c5', borderRadius: 8, padding: '1rem', margin: '0.75rem 0' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Aplikace zaregistrována — client_secret zobrazíme jen jednou:</p>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>client_id: {secret.clientId}</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700 }}>client_secret: {secret.secret}</div>
        </div>
      )}

      {creating && <RegisterForm onDone={(c) => { setCreating(false); setSecret(c); refresh(); }} onCancel={() => setCreating(false)} />}

      {apps.length > 0 && (
        <table style={{ ...tableStyle, marginTop: '0.75rem' }}>
          <thead><tr><th style={th}>Název</th><th style={th}>client_id</th><th style={th}>Oprávnění</th><th style={th} /></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.name}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.client_id}</td>
                <td style={{ ...td, fontSize: '0.75rem', color: '#555' }}>{a.scopes.join(', ')}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button type="button" onClick={() => { if (confirm('Smazat aplikaci?')) del.mutate(a.id); }} style={dangerBtn}>Smazat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RegisterForm({ onDone, onCancel }: { onDone: (c: { clientId: string; secret: string }) => void; onCancel: () => void }) {
  const scopesQuery = useQuery({ queryKey: ['oauth', 'scopes'], queryFn: () => api.listOAuthScopes() });
  const allScopes = scopesQuery.data?.scopes ?? [];
  const [name, setName] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [website, setWebsite] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (scopes.length === 0) throw new Error('Vyberte alespoň jedno oprávnění');
      return api.registerOAuthApp({
        name,
        redirectUris: [redirectUri],
        scopes,
        ...(website && { websiteUrl: website }),
      });
    },
    onSuccess: (r) => onDone({ clientId: r.client_id, secret: r.client_secret }),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: '1rem', margin: '0.75rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={lbl}><span style={lblTxt}>Název</span><input value={name} onChange={(e) => setName(e.target.value)} style={input} /></label>
        <label style={lbl}><span style={lblTxt}>Redirect URI</span><input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="https://app.example.com/callback" style={input} /></label>
        <label style={lbl}><span style={lblTxt}>Web (volitelné)</span><input value={website} onChange={(e) => setWebsite(e.target.value)} style={input} /></label>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <span style={lblTxt}>Oprávnění (scopes)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 4 }}>
          {allScopes.map((s) => (
            <label key={s.scope} style={{ fontSize: '0.8125rem', display: 'flex', gap: 4, alignItems: 'center', border: '1px solid #ddd', borderRadius: 4, padding: '0.25rem 0.5rem' }}>
              <input type="checkbox" checked={scopes.includes(s.scope)} onChange={(e) => setScopes((p) => e.target.checked ? [...p, s.scope] : p.filter((x) => x !== s.scope))} />
              {s.label}
            </label>
          ))}
        </div>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0.5rem 0' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!name || !redirectUri || create.isPending} onClick={() => { setError(null); create.mutate(); }} style={primaryBtn}>
          {create.isPending ? 'Registruji…' : 'Registrovat'}
        </button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const sectionHeader: React.CSSProperties = { margin: '0 0 0.75rem', fontSize: '1rem' };
const muted: React.CSSProperties = { color: '#666', fontSize: '0.875rem', margin: 0 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0.625rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef' };
const td: React.CSSProperties = { padding: '0.625rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem' };
const lblTxt: React.CSSProperties = { display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.8125rem' };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
