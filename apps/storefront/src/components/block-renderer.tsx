/**
 * Storefront renderer for the page-builder block model (per `32-cms-content.md`).
 * Server component: takes the *resolved* block list from the API (product grids,
 * buy buttons and category showcases already expanded to live catalog data) and
 * renders each block with the active theme's CSS variables.
 *
 * Used by the homepage and CMS/landing pages. Interactive blocks (buy_button,
 * newsletter) delegate to client components.
 */

import Link from 'next/link';
import { formatMoney, type Money } from '@/lib/api';
import { BuyButton } from '@/components/buy-button';
import { NewsletterBox } from '@/components/newsletter-box';

type Align = 'left' | 'center' | 'right';

/** Resolved block — loose shape; `type` drives which fields are read. */
export interface ResolvedBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface ProductCard {
  id: string;
  slug: string;
  title: string;
  base_price: Money | null;
  primary_image: { url: string; alt: string | null } | null;
}

const SPACER: Record<string, number> = { sm: 16, md: 40, lg: 80 };
const GAP: Record<string, string> = { sm: '0.75rem', md: '1.5rem', lg: '2.5rem' };

export function BlockRenderer({
  blocks,
  tenantSlug,
  locale,
}: {
  blocks: ResolvedBlock[];
  tenantSlug: string;
  locale: string;
}) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} tenantSlug={tenantSlug} locale={locale} />
      ))}
    </>
  );
}

function BlockView({
  block: b,
  tenantSlug,
  locale,
}: {
  block: ResolvedBlock;
  tenantSlug: string;
  locale: string;
}) {
  const align = (b.align as Align) ?? 'center';
  const textAlign = align;

  switch (b.type) {
    case 'hero':
      return <HeroBlock b={b} />;

    case 'rich_text':
      return (
        <Section>
          <div
            style={{ lineHeight: 1.7, fontSize: '1rem' }}
            // Server-sanitized on resolve (per `32`).
            dangerouslySetInnerHTML={{ __html: String(b.html ?? '') }}
          />
        </Section>
      );

    case 'heading': {
      const Tag = (b.level === 'h3' ? 'h3' : 'h2') as 'h2' | 'h3';
      return (
        <Section>
          <Tag
            style={{
              textAlign,
              fontFamily: 'var(--sf-font-heading)',
              fontSize: b.level === 'h3' ? '1.35rem' : '1.85rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {String(b.text ?? '')}
          </Tag>
        </Section>
      );
    }

    case 'button':
      return (
        <Section>
          <div style={{ display: 'flex', justifyContent: justifyFor(align) }}>
            <a
              href={String(b.href ?? '#')}
              style={{
                display: 'inline-block',
                padding: '0.7rem 1.6rem',
                borderRadius: 'var(--sf-radius, 6px)',
                textDecoration: 'none',
                fontWeight: 500,
                ...(b.variant === 'outline'
                  ? { border: '1.5px solid var(--sf-accent, #111)', color: 'var(--sf-accent, #111)' }
                  : { background: 'var(--sf-accent, #111)', color: '#fff' }),
              }}
            >
              {String(b.label ?? '')}
            </a>
          </div>
        </Section>
      );

    case 'buy_button': {
      const p = b.product as
        | (ProductCard & { variant_id: string | null; in_stock: boolean })
        | undefined;
      if (!p) return null;
      return (
        <Section>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignItems(align), gap: '0.6rem' }}>
            <Link
              href={`/s/${tenantSlug}/p/${p.slug}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', textDecoration: 'none', color: 'inherit' }}
            >
              {p.primary_image && (
                <img
                  src={p.primary_image.url}
                  alt={p.primary_image.alt ?? p.title}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--sf-radius, 6px)' }}
                />
              )}
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{p.title}</span>
                {b.showPrice !== false && p.base_price && (
                  <span style={{ color: 'var(--sf-muted, #666)' }}>{formatMoney(p.base_price, locale)}</span>
                )}
              </span>
            </Link>
            <BuyButton
              variantId={p.variant_id}
              label={String(b.label ?? 'Do košíku')}
              inStock={p.in_stock}
              align={align}
            />
          </div>
        </Section>
      );
    }

    case 'image_banner':
      return (
        <Section wide>
          {b.href ? (
            <a href={String(b.href)}>
              <img src={String(b.imageUrl)} alt={String(b.alt ?? '')} style={bannerImg} />
            </a>
          ) : (
            <img src={String(b.imageUrl)} alt={String(b.alt ?? '')} style={bannerImg} />
          )}
        </Section>
      );

    case 'gallery': {
      const images = (b.images as { url: string; alt: string; href: string | null }[]) ?? [];
      const cols = Number(b.columns) || 3;
      return (
        <Section wide>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem' }}>
            {images.map((img, i) => {
              const el = (
                <img
                  src={img.url}
                  alt={img.alt ?? ''}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 'var(--sf-radius, 6px)' }}
                />
              );
              return img.href ? (
                <a key={i} href={img.href}>{el}</a>
              ) : (
                <div key={i}>{el}</div>
              );
            })}
          </div>
        </Section>
      );
    }

    case 'video': {
      const url = String(b.embedUrl ?? b.url ?? '');
      const isFile = b.provider === 'file';
      return (
        <Section wide>
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 'var(--sf-radius, 6px)', overflow: 'hidden' }}>
            {isFile ? (
              <video
                src={url}
                controls
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              />
            ) : (
              <iframe
                src={url}
                title={String(b.caption ?? 'video')}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            )}
          </div>
          {b.caption ? (
            <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--sf-muted, #666)', marginTop: '0.5rem' }}>
              {String(b.caption)}
            </p>
          ) : null}
        </Section>
      );
    }

    case 'faq': {
      const items = (b.items as { q: string; a: string }[]) ?? [];
      return (
        <Section>
          {b.title ? (
            <h2 style={{ fontFamily: 'var(--sf-font-heading)', fontSize: '1.6rem', marginTop: 0 }}>{String(b.title)}</h2>
          ) : null}
          {items.map((it, i) => (
            <details
              key={i}
              style={{ borderBottom: '1px solid rgba(128,128,128,0.2)', padding: '0.75rem 0' }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{it.q}</summary>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--sf-muted, #444)', lineHeight: 1.6 }}>{it.a}</p>
            </details>
          ))}
        </Section>
      );
    }

    case 'testimonial':
      return (
        <Section>
          <blockquote
            style={{
              margin: 0,
              padding: '1.5rem',
              borderLeft: '3px solid var(--sf-accent, #111)',
              fontStyle: 'italic',
              fontSize: '1.15rem',
              lineHeight: 1.6,
            }}
          >
            "{String(b.quote ?? '')}"
            <footer style={{ marginTop: '0.75rem', fontStyle: 'normal', fontSize: '0.9rem', color: 'var(--sf-muted, #666)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {b.imageUrl ? (
                <img src={String(b.imageUrl)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : null}
              — {String(b.author ?? '')}
            </footer>
          </blockquote>
        </Section>
      );

    case 'product_grid':
    case 'featured_category': {
      const products = (b.products as ProductCard[]) ?? [];
      if (products.length === 0) return null;
      return (
        <Section wide>
          {b.title ? (
            <h2 style={{ fontFamily: 'var(--sf-font-heading)', fontSize: '1.6rem', marginBottom: '1rem' }}>
              {String(b.title)}
            </h2>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {products.map((p) => (
              <ProductTile key={p.id} p={p} tenantSlug={tenantSlug} locale={locale} />
            ))}
          </div>
        </Section>
      );
    }

    case 'newsletter':
      return (
        <Section>
          <div style={{ textAlign: 'center' }}>
            {b.headline ? <h2 style={{ fontFamily: 'var(--sf-font-heading)', fontSize: '1.5rem', margin: '0 0 0.4rem' }}>{String(b.headline)}</h2> : null}
            {b.subheadline ? <p style={{ color: 'var(--sf-muted, #666)', margin: '0 0 1rem' }}>{String(b.subheadline)}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <NewsletterBox tenantSlug={tenantSlug} />
            </div>
          </div>
        </Section>
      );

    case 'spacer':
      return <div style={{ height: SPACER[String(b.size)] ?? SPACER.md }} />;

    case 'section_ref': {
      // Reusable section (per `32` §4.6) — already dereferenced to resolved
      // children server-side; render them stacked, full-width.
      const children = (b.children as ResolvedBlock[]) ?? [];
      if (children.length === 0) return null;
      return (
        <>
          {children.map((child) => (
            <BlockView key={child.id} block={child} tenantSlug={tenantSlug} locale={locale} />
          ))}
        </>
      );
    }

    case 'columns': {
      const children = (b.children as ResolvedBlock[]) ?? [];
      const cols = Number(b.columns) || 2;
      const gap = GAP[String(b.gap)] ?? GAP.md;
      return (
        <Section wide>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
            {children.map((child) => (
              <div key={child.id}>
                <BlockView block={child} tenantSlug={tenantSlug} locale={locale} />
              </div>
            ))}
          </div>
        </Section>
      );
    }

    default:
      return null;
  }
}

// ===== Shared pieces =========================================================

function Section({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <section style={{ maxWidth: wide ? 1120 : 760, margin: '0 auto', padding: '1.25rem 2rem' }}>
      {children}
    </section>
  );
}

function HeroBlock({ b }: { b: ResolvedBlock }) {
  const align = (b.align as Align) ?? 'center';
  const image = b.imageUrl ? String(b.imageUrl) : null;
  return (
    <section
      style={{
        position: 'relative',
        padding: '4rem 2rem',
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        textAlign: align,
        color: image ? '#fff' : 'var(--sf-text, #111)',
        backgroundImage: image ? `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)), url(${image})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {b.headline ? (
        <h2 style={{ fontSize: '2.4rem', fontWeight: 700, margin: 0, maxWidth: 720, fontFamily: 'var(--sf-font-heading)' }}>
          {String(b.headline)}
        </h2>
      ) : null}
      {b.subheadline ? (
        <p style={{ fontSize: '1.1rem', margin: '0.75rem 0 0', maxWidth: 640, opacity: 0.92 }}>
          {String(b.subheadline)}
        </p>
      ) : null}
      {b.ctaLabel && b.ctaHref ? (
        <a
          href={String(b.ctaHref)}
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.75rem',
            background: 'var(--sf-accent, #111)',
            color: '#fff',
            borderRadius: 'var(--sf-radius, 6px)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {String(b.ctaLabel)}
        </a>
      ) : null}
    </section>
  );
}

function ProductTile({ p, tenantSlug, locale }: { p: ProductCard; tenantSlug: string; locale: string }) {
  return (
    <Link
      href={`/s/${tenantSlug}/p/${p.slug}`}
      style={{
        display: 'block',
        background: 'var(--shopio-color-surface-2, transparent)',
        borderRadius: 'var(--sf-radius, 6px)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid rgba(128,128,128,0.2)',
      }}
    >
      <div style={{ aspectRatio: '1 / 1', background: 'rgba(128,128,128,0.08)', overflow: 'hidden' }}>
        {p.primary_image ? (
          <img src={p.primary_image.url} alt={p.primary_image.alt ?? p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-muted, #999)', fontSize: '0.75rem' }}>
            no image
          </div>
        )}
      </div>
      <div style={{ padding: '0.75rem' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.35rem' }}>{p.title}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatMoney(p.base_price, locale)}</div>
      </div>
    </Link>
  );
}

const bannerImg: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
  borderRadius: 'var(--sf-radius, 6px)',
};

function justifyFor(align: Align): string {
  return align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
}
function alignItems(align: Align): string {
  return align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
}
