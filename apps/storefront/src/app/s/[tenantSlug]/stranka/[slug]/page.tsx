import { notFound } from 'next/navigation';
import { getPage } from '@/lib/api';
import { getStorefrontLocale } from '@/lib/locale';
import { BlockRenderer } from '@/components/block-renderer';

interface Props {
  params: Promise<{ tenantSlug: string; slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const page = await getPage(tenantSlug, slug);
  if (!page) return { title: 'Stránka nenalezena' };
  return {
    title: page.seo_title || page.title,
    ...(page.seo_description && { description: page.seo_description }),
  };
}

export default async function ContentPage({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const page = await getPage(tenantSlug, slug);
  if (!page) notFound();

  const locale = (await getStorefrontLocale()) ?? 'cs-CZ';

  // Page-builder blocks take precedence over legacy body_html (per `32`).
  if (page.blocks && page.blocks.length > 0) {
    return (
      <main style={{ padding: '1.5rem 0 4rem' }}>
        <h1 style={{ maxWidth: 760, margin: '0 auto', padding: '0 2rem', fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--sf-font-heading)' }}>
          {page.title}
        </h1>
        <BlockRenderer blocks={page.blocks} tenantSlug={tenantSlug} locale={locale} />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 1.5rem', fontFamily: 'var(--sf-font-heading)' }}>
        {page.title}
      </h1>
      <div
        style={{ lineHeight: 1.7, fontSize: '1rem' }}
        // Body is merchant-authored + server-sanitized (per `32`).
        dangerouslySetInnerHTML={{ __html: page.body_html }}
      />
    </main>
  );
}
