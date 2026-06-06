/**
 * Onboarding — create the merchant's shop (tenant) after signup.
 *
 * POST /tenants provisions defaults server-side (VAT rates, shipping zone +
 * Zásilkovna rates, carrier config), then we switch the JWT to the new tenant
 * and land on the dashboard. Users who already belong to a tenant can also
 * pick one here instead of creating another.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-store';

const COUNTRIES = [
  { code: 'CZ', label: 'Česko', currency: 'CZK', locale: 'cs-CZ' },
  { code: 'SK', label: 'Slovensko', currency: 'EUR', locale: 'sk-SK' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function OnboardingPage() {
  const router = useRouter();
  const { user, applySession } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [countryCode, setCountryCode] = useState('CZ');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const membershipsQuery = useQuery({
    queryKey: ['me', 'tenants'],
    queryFn: () => api.myTenants(),
  });
  const memberships = membershipsQuery.data?.memberships ?? [];

  // Already scoped to a tenant → nothing to onboard
  useEffect(() => {
    if (user?.tenant_id) router.navigate({ to: '/' });
  }, [user?.tenant_id, router]);

  async function selectTenant(tenantPubId: string) {
    setError(null);
    try {
      const res = await api.switchTenant(tenantPubId);
      await applySession(res.access_token);
      router.navigate({ to: '/' });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]!;
      const created = await api.createTenant({
        displayName,
        slug: slug || slugify(displayName),
        countryCode: country.code,
        defaultCurrency: country.currency,
      });
      const res = await api.switchTenant(created.tenant.id);
      await applySession(res.access_token);
      router.navigate({ to: '/' });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'SLUG_TAKEN'
          ? 'Tato adresa obchodu je už obsazená — zvolte jinou.'
          : ((err as Error).message ?? 'Založení obchodu selhalo'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
          Vítejte v Shopio 👋
        </h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#666' }}>
          Založte svůj e-shop — DPH sazby a doprava se nastaví automaticky.
        </p>

        {memberships.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Vaše obchody
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {memberships.map((m) => (
                <button
                  key={m.tenant.id}
                  type="button"
                  onClick={() => void selectTenant(m.tenant.id)}
                  style={tenantBtnStyle}
                >
                  <strong>{m.tenant.display_name}</strong>
                  <span style={{ color: '#666', fontSize: '0.8125rem' }}>
                    /s/{m.tenant.slug} · {m.persona}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ margin: '1rem 0', textAlign: 'center', color: '#999', fontSize: '0.8125rem' }}>
              — nebo založte nový —
            </div>
          </section>
        )}

        <form onSubmit={handleCreate}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Název obchodu</span>
            <input
              type="text"
              required
              autoFocus
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Moje keramika"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Adresa obchodu</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>/s/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Země</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={inputStyle}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.currency})
                </option>
              ))}
            </select>
          </label>

          {error && <p style={errorStyle}>{error}</p>}

          <button type="submit" disabled={submitting || !displayName} style={primaryBtn(submitting)}>
            {submitting ? 'Zakládám obchod…' : 'Založit e-shop'}
          </button>
        </form>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f4f5f7',
  padding: '2rem',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: '#fff',
  padding: '2.5rem',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '1rem',
  fontSize: '0.875rem',
};

const labelTextStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  color: '#c00',
  fontSize: '0.875rem',
  margin: '0 0 1rem',
  padding: '0.5rem 0.75rem',
  background: '#fff5f5',
  border: '1px solid #ffd5d5',
  borderRadius: 4,
};

const tenantBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '0.625rem 0.875rem',
  background: '#f8f9fb',
  border: '1px solid #e3e6ea',
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '0.9375rem',
};

function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.75rem',
    background: '#0066ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.9375rem',
    fontWeight: 500,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
  };
}
