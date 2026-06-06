import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string; slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const post = await getBlogPost(tenantSlug, slug);
  if (!post) return { title: 'Článek nenalezen' };
  return {
    title: post.seo_title || post.title,
    ...((post.seo_description || post.excerpt) && {
      description: post.seo_description || post.excerpt || undefined,
    }),
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const post = await getBlogPost(tenantSlug, slug);
  if (!post) notFound();

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>
      <Link href={`/s/${tenantSlug}/blog`} style={{ fontSize: '0.875rem', color: 'var(--sf-accent, #0066cc)', textDecoration: 'none' }}>
        ← Zpět na blog
      </Link>
      <h1 style={{ fontSize: '2.25rem', fontWeight: 700, margin: '1rem 0 0.5rem', fontFamily: 'var(--sf-font-heading)' }}>
        {post.title}
      </h1>
      {post.published_at && (
        <div style={{ fontSize: '0.875rem', color: 'var(--sf-muted, #888)', marginBottom: '1.5rem' }}>
          {new Date(post.published_at).toLocaleDateString('cs-CZ')}
        </div>
      )}
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt=""
          style={{ width: '100%', borderRadius: 'var(--sf-radius, 8px)', marginBottom: '1.5rem', display: 'block' }}
        />
      )}
      <div
        style={{ lineHeight: 1.7, fontSize: '1.0625rem' }}
        dangerouslySetInnerHTML={{ __html: post.body_html }}
      />
    </main>
  );
}
