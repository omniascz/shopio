import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenant, getPages } from '@/lib/api';
import { CartProvider } from '@/lib/cart-context';
import { CompareProvider } from '@/lib/compare-context';
import { CartDrawer } from '@/components/cart-drawer';
import { CartButton } from '@/components/cart-button';
import { SavedNav } from '@/components/saved-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { NewsletterBox } from '@/components/newsletter-box';
import { AnalyticsScripts } from '@/components/analytics-scripts';
import { getStorefrontLocale } from '@/lib/locale';
import { getStorefrontCurrency } from '@/lib/currency';

interface Props {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

/** Theme presets (per `26-themes-storefront.md` MVP) — merchant picks in admin. */
const THEME_PRESETS: Record<string, { background: string; text: string; muted: string }> = {
  minimal: { background: '#ffffff', text: '#111111', muted: '#666666' },
  warm: { background: '#faf6f0', text: '#2b2118', muted: '#7a6a58' },
  dark: { background: '#161616', text: '#eaeaea', muted: '#9a9a9a' },
};

/** Font + radius token presets (per `26`). */
const FONT_STACKS: Record<string, { heading: string; body: string }> = {
  sans: {
    heading: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  serif: {
    heading: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif',
  },
  mixed: {
    heading: 'Georgia, "Times New Roman", serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
};
const RADIUS_TOKENS: Record<string, string> = { sharp: '0px', soft: '6px', round: '14px' };

export default async function TenantLayout({ children, params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  const pages = await getPages(tenantSlug);
  const cookieLocale = await getStorefrontLocale();
  const enabledLocales = tenant.enabled_locales ?? [tenant.default_locale];
  const currentLocale = enabledLocales.includes(cookieLocale ?? '')
    ? cookieLocale!
    : tenant.default_locale;
  const currentCurrency = await getStorefrontCurrency();

  const appearance = tenant.appearance ?? {
    theme: 'minimal',
    accent_color: '#111111',
    logo_url: null,
  };
  const preset = THEME_PRESETS[appearance.theme] ?? THEME_PRESETS['minimal']!;
  const fonts = FONT_STACKS[appearance.font ?? 'sans'] ?? FONT_STACKS['sans']!;
  const radius = RADIUS_TOKENS[appearance.radius ?? 'soft'] ?? RADIUS_TOKENS['soft']!;
  const secondary = appearance.secondary_color ?? '#0066ff';
  const announcement = tenant.homepage?.announcement;

  return (
    <CartProvider tenantSlug={tenantSlug}>
     <CompareProvider tenantSlug={tenantSlug}>
      <AnalyticsScripts
        ga4Id={tenant.analytics?.ga4_measurement_id}
        metaPixelId={tenant.analytics?.meta_pixel_id}
      />
      <div
        data-theme={appearance.theme}
        style={
          {
            '--sf-accent': appearance.accent_color,
            '--sf-secondary': secondary,
            '--sf-bg': preset.background,
            '--sf-text': preset.text,
            '--sf-muted': preset.muted,
            '--sf-radius': radius,
            '--sf-font-heading': fonts.heading,
            '--sf-font-body': fonts.body,
            background: preset.background,
            color: preset.text,
            fontFamily: fonts.body,
            minHeight: '100vh',
          } as React.CSSProperties
        }
      >
        {announcement?.enabled && announcement.text && (
          <div
            style={{
              background: secondary,
              color: '#fff',
              textAlign: 'center',
              fontSize: '0.8125rem',
              padding: '0.5rem 1rem',
            }}
          >
            {announcement.url ? (
              <a href={announcement.url} style={{ color: '#fff', textDecoration: 'underline' }}>
                {announcement.text}
              </a>
            ) : (
              announcement.text
            )}
          </div>
        )}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 2rem',
            borderBottom: `2px solid ${appearance.accent_color}`,
          }}
        >
          {appearance.logo_url && (
            <img
              src={appearance.logo_url}
              alt=""
              style={{ height: 28, width: 'auto', display: 'block' }}
            />
          )}
          <Link
            href={`/s/${tenantSlug}`}
            style={{
              fontWeight: 700,
              fontSize: '1.0625rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {tenant.display_name}
          </Link>
          <span
            style={{
              marginLeft: 'auto',
              marginRight: '7rem', // clear the fixed cart button
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <SavedNav tenantSlug={tenantSlug} />
            <LocaleSwitcher locales={enabledLocales} current={currentLocale} />
            <CurrencySwitcher currencies={tenant.supported_currencies ?? []} current={currentCurrency} />
            <Link
              href={`/s/${tenantSlug}/ucet`}
              style={{ fontSize: '0.875rem', color: 'inherit', textDecoration: 'none', opacity: 0.85 }}
            >
              👤 Můj účet
            </Link>
          </span>
        </header>
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 40,
          }}
        >
          <CartButton />
        </div>
        {children}
        <footer
          style={{
            marginTop: '3rem',
            borderTop: '1px solid rgba(128,128,128,0.2)',
            padding: '2rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Newsletter</div>
              <NewsletterBox tenantSlug={tenantSlug} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
              <Link href={`/s/${tenantSlug}/kolekce`} style={{ color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>
                Kolekce
              </Link>
              <Link href={`/s/${tenantSlug}/blog`} style={{ color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>
                Blog
              </Link>
              {pages.map((p) => (
                <Link
                  key={p.slug}
                  href={`/s/${tenantSlug}/stranka/${p.slug}`}
                  style={{ color: 'inherit', textDecoration: 'none', opacity: 0.8 }}
                >
                  {p.title}
                </Link>
              ))}
              <span style={{ marginLeft: 'auto', opacity: 0.5 }}>© {tenant.display_name}</span>
            </div>
          </div>
        </footer>
        <CartDrawer />
      </div>
     </CompareProvider>
    </CartProvider>
  );
}
