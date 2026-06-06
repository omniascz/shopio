/**
 * Shop settings — per `27-admin-backoffice.md` settings surface.
 *
 * Sections: Fakturační údaje (feeds invoice seller snapshots), Doprava
 * (rate prices + Packeta credentials), Vzhled (storefront theme preset +
 * accent color).
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ShippingSettings, type ShopSettings } from '../lib/api';

export function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.getSettings(),
  });

  if (settingsQuery.isLoading) return <p>Načítání nastavení…</p>;
  if (settingsQuery.isError || !settingsQuery.data) {
    return <p style={{ color: '#c00' }}>Nastavení se nepodařilo načíst.</p>;
  }

  const settings = settingsQuery.data;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem' }}>Nastavení obchodu</h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#666' }}>
        {settings.display_name} · /s/{settings.slug} · {settings.country_code} ·{' '}
        {settings.default_currency}
      </p>

      <InvoicingSection settings={settings} />
      <ShippingSection currency={settings.default_currency} />
      <AppearanceSection settings={settings} />
    </div>
  );
}

// =============================================================================
// Fakturační údaje
// =============================================================================

function InvoicingSection({ settings }: { settings: ShopSettings }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(settings.display_name);
  const [legalName, setLegalName] = useState(settings.legal_entity_name ?? '');
  const [ico, setIco] = useState(settings.registration_number ?? '');
  const [dic, setDic] = useState(settings.vat_id ?? '');
  const [line1, setLine1] = useState(settings.invoicing.address.line1 ?? '');
  const [city, setCity] = useState(settings.invoicing.address.city ?? '');
  const [postal, setPostal] = useState(settings.invoicing.address.postal_code ?? '');
  const [iban, setIban] = useState(settings.invoicing.bank_account_iban ?? '');
  const [swift, setSwift] = useState(settings.invoicing.bank_account_swift ?? '');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateSettings({
        displayName,
        legalEntityName: legalName || null,
        registrationNumber: ico || null,
        vatId: dic || null,
        invoicing: {
          address: { line1, city, postal_code: postal },
          bank_account_iban: iban,
          bank_account_swift: swift,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
    onError: (err) => setError((err as Error).message),
  });

  const missingLegal = !ico && !dic;

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Fakturační údaje</h2>
      {missingLegal && (
        <p style={warningStyle}>
          ⚠ Bez IČO/DIČ budou vystavené faktury neúplné. Doplňte údaje k podnikání.
        </p>
      )}
      <div style={grid2}>
        <Field label="Název obchodu">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Právní subjekt (název firmy / OSVČ)">
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Moje firma s.r.o."
            style={inputStyle}
          />
        </Field>
        <Field label="IČO">
          <input value={ico} onChange={(e) => setIco(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="DIČ (prázdné = neplátce DPH)">
          <input value={dic} onChange={(e) => setDic(e.target.value)} placeholder="CZ12345678" style={inputStyle} />
        </Field>
      </div>
      <Field label="Ulice a číslo">
        <input value={line1} onChange={(e) => setLine1(e.target.value)} style={inputStyle} />
      </Field>
      <div style={grid2}>
        <Field label="Město">
          <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="PSČ">
          <input value={postal} onChange={(e) => setPostal(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="IBAN">
          <input value={iban} onChange={(e) => setIban(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="SWIFT/BIC">
          <input value={swift} onChange={(e) => setSwift(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      {error && <p style={errorStyle}>{error}</p>}
      <SaveButton mutation={saveMutation} onClick={() => { setError(null); saveMutation.mutate(); }} />
      <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.75rem 0 0' }}>
        Údaje se propíšou do nově vystavených faktur (již vystavené zůstávají beze změny).
      </p>
    </section>
  );
}

// =============================================================================
// Doprava
// =============================================================================

function ShippingSection({ currency }: { currency: string }) {
  const queryClient = useQueryClient();
  const shippingQuery = useQuery({
    queryKey: ['admin', 'settings', 'shipping'],
    queryFn: () => api.getShippingSettings(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'shipping'] });

  const data = shippingQuery.data;

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Doprava</h2>
      {shippingQuery.isLoading && <p>Načítání…</p>}
      {data && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>Metoda</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cena ({currency})</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Zdarma od</th>
                <th style={thStyle}>Aktivní</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {data.rates.map((r) => (
                <RateRow key={r.id} rate={r} onSaved={invalidate} />
              ))}
            </tbody>
          </table>

          {data.providers.map((p) => (
            <ProviderForm key={p.carrier_code} provider={p} onSaved={invalidate} />
          ))}
        </>
      )}
    </section>
  );
}

function toMajor(minor: string | null): string {
  if (!minor) return '';
  const n = BigInt(minor);
  return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}

function toMinor(value: string): string | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major, frac = ''] = normalized.split('.');
  return `${major}${frac.padEnd(2, '0')}`;
}

function RateRow({
  rate,
  onSaved,
}: {
  rate: ShippingSettings['rates'][number];
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(toMajor(rate.amount));
  const [freeAbove, setFreeAbove] = useState(toMajor(rate.free_above_amount));
  const [active, setActive] = useState(rate.is_active);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(toMajor(rate.amount));
    setFreeAbove(toMajor(rate.free_above_amount));
    setActive(rate.is_active);
  }, [rate.id, rate.amount, rate.free_above_amount, rate.is_active]);

  const dirty =
    amount !== toMajor(rate.amount) ||
    freeAbove !== toMajor(rate.free_above_amount) ||
    active !== rate.is_active;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountMinor = toMinor(amount);
      if (amount && !amountMinor) throw new Error('Neplatná cena');
      const freeMinor = freeAbove === '' ? null : toMinor(freeAbove);
      if (freeAbove && !freeMinor) throw new Error('Neplatný práh dopravy zdarma');
      return api.updateShippingRate(rate.id, {
        ...(amountMinor && { amount: amountMinor }),
        freeAboveAmount: freeMinor,
        isActive: active,
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  return (
    <>
      <tr>
        <td style={tdStyle}>
          {rate.display_name}
          {rate.pickup_only && (
            <span style={{ color: '#888', fontSize: '0.75rem' }}> · výdejní místo</span>
          )}
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 80, textAlign: 'right', padding: '0.375rem 0.5rem' }} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input
            value={freeAbove}
            placeholder="—"
            onChange={(e) => setFreeAbove(e.target.value)}
            style={{ ...inputStyle, width: 90, textAlign: 'right', padding: '0.375rem 0.5rem' }}
          />
        </td>
        <td style={tdStyle}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => { setError(null); saveMutation.mutate(); }}
            style={{ ...smallBtnStyle, opacity: !dirty || saveMutation.isPending ? 0.5 : 1 }}
          >
            Uložit
          </button>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={5} style={{ ...tdStyle, color: '#c00', fontSize: '0.8125rem' }}>{error}</td>
        </tr>
      )}
    </>
  );
}

function ProviderForm({
  provider,
  onSaved,
}: {
  provider: ShippingSettings['providers'][number];
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(provider.is_enabled);
  const [widgetKey, setWidgetKey] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateShippingProvider(provider.carrier_code, {
        isEnabled: enabled,
        ...(widgetKey && { widgetApiKey: widgetKey }),
        ...(apiPassword && { apiPassword }),
      }),
    onSuccess: () => {
      setWidgetKey('');
      setApiPassword('');
      onSaved();
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div style={{ border: '1px solid #e9ecef', borderRadius: 6, padding: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <strong style={{ fontSize: '0.9375rem' }}>{provider.display_name}</strong>
        <label style={{ fontSize: '0.8125rem', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          aktivní
        </label>
      </div>
      <div style={grid2}>
        <Field label={`Widget API klíč ${provider.has_widget_key ? '(nastaven ✓)' : ''}`}>
          <input
            type="password"
            value={widgetKey}
            placeholder={provider.has_widget_key ? '••••••••' : 'klíč z klientské sekce Packeta'}
            onChange={(e) => setWidgetKey(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label={`API heslo (štítky) ${provider.has_api_password ? '(nastaveno ✓)' : ''}`}>
          <input
            type="password"
            value={apiPassword}
            placeholder={provider.has_api_password ? '••••••••' : 'REST API heslo'}
            onChange={(e) => setApiPassword(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      <SaveButton mutation={saveMutation} onClick={() => { setError(null); saveMutation.mutate(); }} />
      {!provider.has_api_password && (
        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.5rem 0 0' }}>
          Bez API hesla se štítky generují v mock režimu (jen pro vývoj/test).
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Vzhled
// =============================================================================

const THEMES = [
  { value: 'minimal', label: 'Minimal', hint: 'čistý bílý, tenké linky' },
  { value: 'warm', label: 'Warm', hint: 'krémové pozadí, zaoblené prvky' },
  { value: 'dark', label: 'Dark', hint: 'tmavé pozadí, světlý text' },
];

function AppearanceSection({ settings }: { settings: ShopSettings }) {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(settings.appearance.theme);
  const [accent, setAccent] = useState(settings.appearance.accent_color);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => api.updateAppearance({ theme, accentColor: accent }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Vzhled storefrontu</h2>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              border: theme === t.value ? `2px solid ${accent}` : '1px solid #ddd',
              background:
                t.value === 'dark' ? '#1a1a1a' : t.value === 'warm' ? '#faf6f0' : '#fff',
              color: t.value === 'dark' ? '#eee' : '#111',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{t.label}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.hint}</div>
          </button>
        ))}
      </div>
      <Field label="Akcentní barva (tlačítka, odkazy)">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            style={{ width: 44, height: 32, padding: 2, border: '1px solid #ddd', borderRadius: 4 }}
          />
          <input
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            style={{ ...inputStyle, width: 110 }}
          />
        </div>
      </Field>
      {error && <p style={errorStyle}>{error}</p>}
      <SaveButton mutation={saveMutation} onClick={() => { setError(null); saveMutation.mutate(); }} />
    </section>
  );
}

// =============================================================================
// Shared
// =============================================================================

function SaveButton({
  mutation,
  onClick,
}: {
  mutation: { isPending: boolean; isSuccess: boolean };
  onClick: () => void;
}) {
  return (
    <span>
      <button type="button" disabled={mutation.isPending} onClick={onClick} style={primaryBtnStyle}>
        {mutation.isPending ? 'Ukládám…' : 'Uložit'}
      </button>
      {mutation.isSuccess && (
        <span style={{ marginLeft: '0.75rem', color: '#2e7d32', fontSize: '0.875rem' }}>
          ✓ Uloženo
        </span>
      )}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.875rem', fontSize: '0.875rem' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  marginBottom: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 600,
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0 0.75rem',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem 0.625rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};

const errorStyle: React.CSSProperties = {
  color: '#c00',
  fontSize: '0.875rem',
  margin: '0.5rem 0',
};

const warningStyle: React.CSSProperties = {
  background: '#fff8e1',
  border: '1px solid #ffe082',
  color: '#7a5c00',
  borderRadius: 4,
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  margin: '0 0 1rem',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  background: '#0066ff',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  background: '#f0f7ff',
  border: '1px solid #cce0ff',
  color: '#003d99',
  borderRadius: 4,
  fontSize: '0.75rem',
  cursor: 'pointer',
};
