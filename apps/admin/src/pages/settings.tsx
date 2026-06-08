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
      <FeedsSection slug={settings.slug} />
      <AppearanceSection settings={settings} />
      <HomepageSection settings={settings} />
      <LocalesSection />
    </div>
  );
}

// =============================================================================
// Marketing feedy (per `29-integrations.md`) — Heureka / Zboží.cz / Glami
// =============================================================================

function FeedsSection({ slug }: { slug: string }) {
  const base = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3030').replace(/\/$/, '');
  const feeds = [
    { code: 'heureka', label: 'Heureka.cz' },
    { code: 'zbozi', label: 'Zboží.cz' },
    { code: 'glami', label: 'Glami (móda)' },
  ];
  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Marketing feedy</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Vložte tyto XML adresy do administrace srovnávačů. Feed se generuje automaticky z aktivních
        produktů a aktualizuje se průběžně.
      </p>
      {feeds.map((f) => {
        const url = `${base}/s/${slug}/feeds/${f.code}.xml`;
        return (
          <div key={f.code} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ width: 90, fontSize: '0.875rem', fontWeight: 500 }}>{f.label}</span>
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(url)}
              style={{ padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Kopírovat
            </button>
          </div>
        );
      })}
    </section>
  );
}

// =============================================================================
// Jazyky (per `23-i18n.md`)
// =============================================================================

function LocalesSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'locale-settings'], queryFn: () => api.getLocaleSettings() });
  const mutation = useMutation({
    mutationFn: (enabled: string[]) => api.setLocaleSettings(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'locale-settings'] }),
  });
  const d = query.data;

  function toggle(code: string, on: boolean) {
    if (!d) return;
    const next = on
      ? [...d.enabled_locales, code]
      : d.enabled_locales.filter((l) => l !== code);
    mutation.mutate(next);
  }

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Jazyky</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Povolené jazyky obchodu. Výchozí jazyk ({d?.default_locale}) je vždy zapnutý.
        Překlady produktů zadáte na detailu produktu.
      </p>
      {d &&
        d.available_locales.map((l) => {
          const enabled = d.enabled_locales.includes(l.code);
          const isDefault = l.code === d.default_locale;
          return (
            <label key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.25rem 0', fontSize: '0.9375rem' }}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={isDefault || mutation.isPending}
                onChange={(e) => toggle(l.code, e.target.checked)}
              />
              {l.name} <span style={{ color: '#999', fontSize: '0.8125rem' }}>{l.code}</span>
              {isDefault && <span style={{ color: '#999', fontSize: '0.75rem' }}>(výchozí)</span>}
            </label>
          );
        })}
    </section>
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
  const [webhookSecret, setWebhookSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateShippingProvider(provider.carrier_code, {
        isEnabled: enabled,
        ...(widgetKey && { widgetApiKey: widgetKey }),
        ...(apiPassword && { apiPassword }),
        ...(webhookSecret && { webhookSecret }),
      }),
    onSuccess: () => {
      setWidgetKey('');
      setApiPassword('');
      setWebhookSecret('');
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
        <Field label={`Webhook secret (sledování) ${provider.has_webhook_secret ? '(nastaven ✓)' : ''}`}>
          <input
            type="password"
            value={webhookSecret}
            placeholder={provider.has_webhook_secret ? '••••••••' : 'min. 16 znaků, vymyslete vlastní'}
            onChange={(e) => setWebhookSecret(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
      {provider.webhook_url && (
        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 0.75rem', wordBreak: 'break-all' }}>
          Webhook URL pro klientskou sekci dopravce: <code>{provider.webhook_url}</code>
        </p>
      )}
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
  const [secondary, setSecondary] = useState(settings.appearance.secondary_color ?? '#0066ff');
  const [font, setFont] = useState(settings.appearance.font ?? 'sans');
  const [radius, setRadius] = useState(settings.appearance.radius ?? 'soft');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateAppearance({ theme, accentColor: accent, secondaryColor: secondary, font, radius }),
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
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Field label="Akcentní barva (tlačítka)">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: 44, height: 32, padding: 2, border: '1px solid #ddd', borderRadius: 4 }}
            />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} style={{ ...inputStyle, width: 100 }} />
          </div>
        </Field>
        <Field label="Sekundární barva (lišta, štítky)">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              style={{ width: 44, height: 32, padding: 2, border: '1px solid #ddd', borderRadius: 4 }}
            />
            <input value={secondary} onChange={(e) => setSecondary(e.target.value)} style={{ ...inputStyle, width: 100 }} />
          </div>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Field label="Písmo">
          <select value={font} onChange={(e) => setFont(e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="sans">Bezpatkové (sans)</option>
            <option value="serif">Patkové (serif)</option>
            <option value="mixed">Kombinace (nadpisy serif)</option>
          </select>
        </Field>
        <Field label="Zaoblení rohů">
          <select value={radius} onChange={(e) => setRadius(e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="sharp">Ostré</option>
            <option value="soft">Jemné</option>
            <option value="round">Výrazné</option>
          </select>
        </Field>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      <SaveButton mutation={saveMutation} onClick={() => { setError(null); saveMutation.mutate(); }} />
    </section>
  );
}

// =============================================================================
// Domovská stránka (per `26`)
// =============================================================================

function HomepageSection({ settings }: { settings: ShopSettings }) {
  const queryClient = useQueryClient();
  const hp = settings.homepage;
  const [annEnabled, setAnnEnabled] = useState(hp?.announcement.enabled ?? false);
  const [annText, setAnnText] = useState(hp?.announcement.text ?? '');
  const [annUrl, setAnnUrl] = useState(hp?.announcement.url ?? '');
  const [heroEnabled, setHeroEnabled] = useState(hp?.hero.enabled ?? false);
  const [headline, setHeadline] = useState(hp?.hero.headline ?? '');
  const [subheadline, setSubheadline] = useState(hp?.hero.subheadline ?? '');
  const [ctaText, setCtaText] = useState(hp?.hero.cta_text ?? '');
  const [ctaUrl, setCtaUrl] = useState(hp?.hero.cta_url ?? '');
  const [imageUrl, setImageUrl] = useState(hp?.hero.image_url ?? '');
  const [align, setAlign] = useState(hp?.hero.align ?? 'center');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateHomepage({
        announcement: { enabled: annEnabled, text: annText, ...(annUrl && { url: annUrl }) },
        hero: {
          enabled: heroEnabled,
          align,
          ...(headline && { headline }),
          ...(subheadline && { subheadline }),
          ...(ctaText && { cta_text: ctaText }),
          ...(ctaUrl && { cta_url: ctaUrl }),
          ...(imageUrl && { image_url: imageUrl }),
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Domovská stránka</h2>

      <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>Oznamovací lišta</h3>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <input type="checkbox" checked={annEnabled} onChange={(e) => setAnnEnabled(e.target.checked)} />
        Zobrazit lištu nahoře
      </label>
      <Field label="Text lišty">
        <input value={annText} onChange={(e) => setAnnText(e.target.value)} style={inputStyle} placeholder="Doprava zdarma nad 1500 Kč" />
      </Field>
      <Field label="Odkaz lišty (volitelné)">
        <input value={annUrl} onChange={(e) => setAnnUrl(e.target.value)} style={inputStyle} placeholder="/s/.../akce" />
      </Field>

      <h3 style={{ fontSize: '0.9375rem', margin: '1rem 0 0.5rem' }}>Hero banner</h3>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <input type="checkbox" checked={heroEnabled} onChange={(e) => setHeroEnabled(e.target.checked)} />
        Zobrazit hero na domovské stránce
      </label>
      <Field label="Nadpis">
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Podnadpis">
        <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Field label="Text tlačítka">
          <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} style={{ ...inputStyle, width: 180 }} />
        </Field>
        <Field label="Odkaz tlačítka">
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} style={{ ...inputStyle, width: 220 }} />
        </Field>
        <Field label="Zarovnání">
          <select value={align} onChange={(e) => setAlign(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="center">Na střed</option>
            <option value="left">Vlevo</option>
          </select>
        </Field>
      </div>
      <Field label="URL obrázku pozadí (volitelné)">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} placeholder="https://…" />
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
