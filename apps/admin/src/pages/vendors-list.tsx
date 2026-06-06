/**
 * Prodejci (marketplace) — vendor list + create + commission ledger (per `25` MVP).
 * Payment-independent: shows recorded commissions/earnings; payouts deferred.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatMoney, type VendorItem } from '../lib/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čeká',
  active: 'Aktivní',
  suspended: 'Pozastaven',
  closed: 'Uzavřen',
};

export function VendorsListPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'vendors'], queryFn: () => api.listVendors() });
  const [creating, setCreating] = useState(false);
  const vendors = query.data?.vendors ?? [];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Prodejci (marketplace)</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
            Třetí strany prodávají ve vašem obchodě; platforma si bere provizi z každého řádku.
            Produkt přiřadíte prodejci na detailu produktu. (Výplaty zatím nejsou — odloženo k platbám.)
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>+ Nový prodejce</button>
        )}
      </header>

      {creating && (
        <CreateForm
          onDone={() => { setCreating(false); queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] }); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {query.isLoading && <p>Načítání…</p>}
      {vendors.length > 0 && (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Prodejce</th>
                <th style={{ ...th, textAlign: 'right' }}>Provize</th>
                <th style={{ ...th, textAlign: 'right' }}>Produkty</th>
                <th style={{ ...th, textAlign: 'right' }}>Výdělek</th>
                <th style={{ ...th, textAlign: 'center' }}>Stav</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <VendorRow key={v.id} vendor={v} queryClient={queryClient} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorRow({ vendor, queryClient }: { vendor: VendorItem; queryClient: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: (body: { status?: string; commissionBasisPoints?: number }) => api.updateVendor(vendor.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] }),
  });
  const ledger = useQuery({
    queryKey: ['admin', 'vendor-commissions', vendor.id],
    queryFn: () => api.getVendorCommissions(vendor.id),
    enabled: open,
  });

  return (
    <>
      <tr>
        <td style={td}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ background: 'none', border: 'none', color: '#0066ff', cursor: 'pointer', padding: 0, fontWeight: 500, fontSize: '0.9375rem' }}>
            {open ? '▾ ' : '▸ '}{vendor.display_name}
          </button>
          <div style={{ color: '#999', fontSize: '0.75rem' }}>{vendor.contact_email}</div>
        </td>
        <td style={{ ...td, textAlign: 'right' }}>
          <input
            type="number" min={0} max={100} step={0.5}
            defaultValue={vendor.commission_basis_points / 100}
            onBlur={(e) => {
              const bps = Math.round(Number(e.target.value) * 100);
              if (bps !== vendor.commission_basis_points && bps >= 0 && bps <= 10000) mut.mutate({ commissionBasisPoints: bps });
            }}
            style={{ width: 56, padding: '0.25rem', textAlign: 'right', border: '1px solid #ddd', borderRadius: 4 }}
          /> %
        </td>
        <td style={{ ...td, textAlign: 'right' }}>{vendor.products ?? 0}</td>
        <td style={{ ...td, textAlign: 'right' }}>
          {formatMoney({ amount: vendor.vendor_earnings ?? '0', currency: 'CZK' })}
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <select
            value={vendor.status}
            onChange={(e) => mut.mutate({ status: e.target.value })}
            disabled={mut.isPending}
            style={{ padding: '0.25rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem' }}
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ ...td, background: '#fafafa' }}>
            {!ledger.data ? (
              <span style={{ color: '#999', fontSize: '0.8125rem' }}>Načítání provizí…</span>
            ) : ledger.data.commissions.length === 0 ? (
              <span style={{ color: '#999', fontSize: '0.8125rem' }}>Zatím žádné prodeje.</span>
            ) : (
              <div>
                <div style={{ fontSize: '0.8125rem', marginBottom: 6 }}>
                  Celkem: <strong>{ledger.data.totals.lines}</strong> řádků · provize{' '}
                  {formatMoney({ amount: ledger.data.totals.commission, currency: 'CZK' })} · výdělek{' '}
                  {formatMoney({ amount: ledger.data.totals.vendor_earnings, currency: 'CZK' })}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <tbody>
                    {ledger.data.commissions.slice(0, 20).map((c, i) => (
                      <tr key={i}>
                        <td style={tdSm}>{c.order_number}</td>
                        <td style={{ ...tdSm, textAlign: 'right' }}>{formatMoney({ amount: c.line_subtotal, currency: c.currency })}</td>
                        <td style={{ ...tdSm, textAlign: 'right', color: '#c0392b' }}>−{formatMoney({ amount: c.commission, currency: c.currency })}</td>
                        <td style={{ ...tdSm, textAlign: 'right', color: '#1c7c34' }}>{formatMoney({ amount: c.vendor_earning, currency: c.currency })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [commissionPct, setCommissionPct] = useState('15');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => api.createVendor({ displayName, contactEmail, commissionBasisPoints: Math.round(Number(commissionPct) * 100) }),
    onSuccess: onDone,
    onError: (e) => setError((e as Error).message),
  });
  return (
    <div style={card}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 1rem' }}>Nový prodejce</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input placeholder="Název prodejce" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={input} />
        <input placeholder="Kontaktní e-mail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={input} />
        <input placeholder="Provize %" type="number" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} style={{ ...input, width: 100 }} />
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button type="button" onClick={() => { setError(null); mut.mutate(); }} disabled={mut.isPending || !displayName || !contactEmail} style={primaryBtn}>
          {mut.isPending ? 'Ukládám…' : 'Vytvořit'}
        </button>
        <button type="button" onClick={onCancel} style={ghostBtn}>Zrušit</button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef', marginBottom: '1rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef' };
const td: React.CSSProperties = { padding: '0.625rem 0.5rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const tdSm: React.CSSProperties = { padding: '0.25rem 0.5rem' };
const input: React.CSSProperties = { padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9375rem' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { padding: '0.4rem 0.875rem', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
