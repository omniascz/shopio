import { notFound } from 'next/navigation';
import { getPage } from '@/lib/api';

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
