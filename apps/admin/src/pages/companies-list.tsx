/**
 * Firmy (B2B) — company list + NET-terms management (per `21-b2b-complete.md` MVP).
 *
 * Customers fill their own company billing profile (IČO/DIČ/adresa) on the
 * storefront. Here the merchant grants/revokes pay-on-invoice (NET terms) and
 * sets the term length — the privilege that unlocks the "platba na fakturu"
 * checkout option for that company.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CompanyItem } from '../lib/api';

export function CompaniesListPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'companies'], queryFn: () => api.listCompanies() });
  const companies = query.data?.companies ?? [];

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Firmy (B2B)</h1>
        <p style={{ color: '#666', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
          Zákazníci si vyplní fakturační údaje firmy ve svém účtu. Zde povolíte
          platbu na fakturu (převodem se splatností).
        </p>
      </header>

      {query.isLoading && <p>Načítání…</p>}
      {query.isError && <p style={{ color: '#c00' }}>Nepodařilo se načíst firmy.</p>}

      {!query.isLoading && companies.length === 0 && (
        <div style={card}>
          <p style={{ color: '#666', fontSize: '0.9375rem', margin: 0 }}>
            Zatím žádné firemní účty. Jakmile si zákazník vyplní fakturační údaje
            firmy, objeví se zde.
          </p>
        </div>
      )}

      {companies.length > 0 && (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Firma</th>
                <th style={th}>IČO</th>
                <th style={th}>DIČ</th>
                <th style={{ ...th, textAlign: 'center' }}>Účty</th>
                <th style={{ ...th, textAlign: 'center' }}>Platba na fakturu</th>
                <th style={{ ...th, textAlign: 'right' }}>Splatnost</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <CompanyRow key={c.id} company={c} queryClient={queryClient} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  queryClient,
}: {
  company: CompanyItem;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [days, setDays] = useState(company.net_terms_days);

  const mutation = useMutation({
    mutationFn: (body: { netTermsEnabled?: boolean; netTermsDays?: number }) =>
      api.updateCompany(company.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] }),
  });

  return (
    <tr>
      <td style={td}>
        <strong>{company.name}</strong>
      </td>
      <td style={td}>{company.registration_number ?? '—'}</td>
      <td style={td}>{company.vat_id ?? '—'}</td>
      <td style={{ ...td, textAlign: 'center' }}>{company.members}</td>
      <td style={{ ...td, textAlign: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={company.net_terms_enabled}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate({ netTermsEnabled: e.target.checked })}
          />
          <span style={{ fontSize: '0.8125rem', color: company.net_terms_enabled ? '#0a7d22' : '#999' }}>
            {company.net_terms_enabled ? 'Povoleno' : 'Vypnuto'}
          </span>
        </label>
      </td>
      <td style={{ ...td, textAlign: 'right' }}>
        <input
          type="number"
          min={1}
          max={180}
          value={days}
          disabled={!company.net_terms_enabled || mutation.isPending}
          onChange={(e) => setDays(Number(e.target.value))}
          onBlur={() => {
            if (days !== company.net_terms_days && days >= 1 && days <= 180) {
              mutation.mutate({ netTermsDays: days });
            }
          }}
          style={{
            width: 56,
            padding: '0.25rem 0.375rem',
            border: '1px solid #ddd',
            borderRadius: 4,
            textAlign: 'right',
            fontSize: '0.875rem',
          }}
        />{' '}
        <span style={{ fontSize: '0.75rem', color: '#999' }}>dní</span>
      </td>
    </tr>
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
