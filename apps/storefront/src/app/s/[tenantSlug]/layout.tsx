import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenant } from '@/lib/api';
import { CartProvider } from '@/lib/cart-context';
import { CompareProvider } from '@/lib/compare-context';
import { CartDrawer } from '@/components/cart-drawer';
import { CartButton } from '@/components/cart-button';
import { SavedNav } from '@/components/saved-nav';

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

export default async function TenantLayout({ children, params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  const appearance = tenant.appearance ?? {
    theme: 'minimal',
    accent_color: '#111111',
    logo_url: null,
  };
  const preset = THEME_PRESETS[appearance.theme] ?? THEME_PRESETS['minimal']!;

  return (
    <CartProvider tenantSlug={tenantSlug}>
     <CompareProvider tenantSlug={tenantSlug}>
      <div
        data-theme={appearance.theme}
        style={
          {
            '--sf-accent': appearance.accent_color,
            '--sf-bg': preset.background,
            '--sf-text': preset.text,
            '--sf-muted': preset.muted,
            background: preset.background,
            color: preset.text,
            minHeight: '100vh',
          } as React.CSSProperties
        }
      >
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
        <CartDrawer />
      </div>
     </CompareProvider>
    </CartProvider>
  );
}
