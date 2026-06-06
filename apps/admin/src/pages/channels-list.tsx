/**
 * Prodejní kanály — per `22-multistore-channels.md` MVP.
 * List channels, toggle active, and jump to manual order entry.
 */

import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ChannelItem } from '../lib/api';

const KIND_LABELS: Record<string, string> = {
  storefront_web: 'Web',
  manual: 'Ruční',
  pos: 'Prodejna',
  marketplace: 'Tržiště',
  mobile_app: 'Aplikace',
  b2b_portal: 'B2B portál',
};

export function ChannelsListPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'channels'], queryFn: () => api.listChannels() });
  const channels = query.data?.channels ?? [];

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateChannel(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'channels'] }),
  });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Prodejní kanály</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
            Odkud přicházejí objednávky. Ruční kanál umožní zadat telefonickou
            objednávku, která neprošla webem.
          </p>
        </div>
        <Link
          to="/orders/manual"
          style={{
            padding: '0.625rem 1rem',
            background: '#0066ff',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          + Nová ruční objednávka
        </Link>
      </header>

      {query.isLoading && <p>Načítání…</p>}

      {channels.length > 0 && (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Kanál</th>
                <th style={th}>Typ</th>
                <th style={{ ...th, textAlign: 'center' }}>Objednávky</th>
                <th style={{ ...th, textAlign: 'center' }}>Aktivní</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c: ChannelItem) => (
                <tr key={c.id}>
                  <td style={td}>
                    <strong>{c.name}</strong>
                    <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: 6 }}>{c.code}</span>
                  </td>
                  <td style={td}>{KIND_LABELS[c.kind] ?? c.kind}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{c.orders}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={c.is_active}
                        disabled={toggle.isPending}
                        onChange={(e) => toggle.mutate({ id: c.id, isActive: e.target.checked })}
                      />
                      <span style={{ fontSize: '0.8125rem', color: c.is_active ? '#0a7d22' : '#999' }}>
                        {c.is_active ? 'Aktivní' : 'Vypnuto'}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};
const td: React.CSSProperties = {
  padding: '0.625rem 0.5rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};
