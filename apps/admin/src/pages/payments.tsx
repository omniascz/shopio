/**
 * Platby (payment providers) — per-tenant gateway configuration (per `13` MVP).
 *
 * Offline methods (COD / bank transfer) work out of the box; gateways (GoPay)
 * need credentials + can run in test mode (mock) before going live. Higher
 * priority = offered first at checkout.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PaymentProviderItem, type PaymentProviderUpdate } from '../lib/api';

export function PaymentsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'payment-providers'],
    queryFn: () => api.listPaymentProviders(),
  });
  const providers = query.data?.providers ?? [];

  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>Platby</h1>
      <p style={hint}>
        Vyberte, jaké platební metody nabídnete v pokladně. Metody s vyšší prioritou se zobrazí
        první. Brány můžete nejdřív vyzkoušet v testovacím režimu.
      </p>
      {query.isLoading && <p>Načítám…</p>}
      {providers.map((p) => (
        <ProviderCard
          key={p.code}
          provider={p}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin', 'payment-providers'] })}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  onSaved,
}: {
  provider: PaymentProviderItem;
  onSaved: () => void;
}) {
  const cfg = provider.config;
  const [priority, setPriority] = useState(cfg?.priority ?? 0);
  const [testMode, setTestMode] = useState(cfg?.is_test_mode ?? true);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const isGateway = provider.kind === 'redirect';
  const enabled = cfg?.is_enabled ?? false;

  const save = useMutation({
    mutationFn: (body: PaymentProviderUpdate) => api.updatePaymentProvider(provider.code, body),
    onSuccess: () => {
      setError(null);
      setCreds({});
      onSaved();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Uložení selhalo'),
  });

  const toggle = (next: boolean) =>
    save.mutate({
      isEnabled: next,
      isTestMode: testMode,
      priority,
      ...(Object.keys(creds).length > 0 && { credentials: creds }),
    });

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <h2 style={h2}>
            {provider.displayName}{' '}
            {enabled ? (
              <span style={badge('#1c7c34', '#e3f5e8')}>Aktivní</span>
            ) : (
              <span style={badge('#999', '#f1f3f5')}>Vypnuto</span>
            )}
            {isGateway && cfg?.is_test_mode && enabled && (
              <span style={badge('#b8860b', '#fff7e0')}>Testovací režim</span>
            )}
          </h2>
          <p style={{ ...hint, margin: 0 }}>{provider.description}</p>
        </div>
        {provider.wired ? (
          <button
            type="button"
            onClick={() => toggle(!enabled)}
            disabled={save.isPending}
            style={enabled ? ghostBtn : primaryBtn}
          >
            {save.isPending ? '…' : enabled ? 'Vypnout' : 'Aktivovat'}
          </button>
        ) : (
          <span style={{ ...hint, fontStyle: 'italic' }}>Brzy</span>
        )}
      </div>

      {provider.wired && (
        <div style={{ marginTop: '0.875rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <label style={field}>
            <span style={fieldLabel}>Priorita</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              style={{ ...input, width: 80 }}
            />
          </label>

          {isGateway && (
            <>
              <label style={{ ...field, alignSelf: 'center' }}>
                <span style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                  />
                  Testovací režim {testMode && '(mock — bez reálných plateb)'}
                </span>
              </label>

              {provider.code === 'gopay' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexBasis: '100%' }}>
                  {(['goId', 'clientId', 'clientSecret'] as const).map((k) => (
                    <input
                      key={k}
                      placeholder={
                        cfg?.has_credentials ? `${k} (uloženo — vyplňte pro změnu)` : k
                      }
                      value={creds[k] ?? ''}
                      onChange={(e) => setCreds((c) => ({ ...c, [k]: e.target.value }))}
                      style={{ ...input, flex: 1, minWidth: 160 }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() =>
              save.mutate({
                isEnabled: enabled,
                isTestMode: testMode,
                priority,
                ...(Object.keys(creds).length > 0 && { credentials: creds }),
              })
            }
            disabled={save.isPending}
            style={ghostBtn}
          >
            Uložit
          </button>
        </div>
      )}

      {error && <p style={{ color: '#c0392b', fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>{error}</p>}
    </section>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const h2: React.CSSProperties = { margin: '0 0 0.25rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const hint: React.CSSProperties = { fontSize: '0.8125rem', color: '#666', margin: '0 0 1rem' };
const input: React.CSSProperties = { padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9375rem' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { padding: '0.4rem 0.85rem', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabel: React.CSSProperties = { fontSize: '0.75rem', color: '#666' };
function badge(color: string, bg: string): React.CSSProperties {
  return { fontSize: '0.6875rem', fontWeight: 600, color, background: bg, padding: '0.1rem 0.4rem', borderRadius: 4 };
}
