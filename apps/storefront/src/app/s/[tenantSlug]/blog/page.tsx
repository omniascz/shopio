import Link from 'next/link';
import { getBlogPosts } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export const metadata = { title: 'Blog' };

export default async function BlogIndex({ params }: Props) {
  const { tenantSlug } = await params;
  const posts = await getBlogPosts(tenantSlug);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 1.5rem', fontFamily: 'var(--sf-font-heading)' }}>
        Blog
      </h1>
      {posts.length === 0 ? (
        <p style={{ color: 'var(--sf-muted, #666)' }}>Zatím žádné články.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/s/${tenantSlug}/blog/${p.slug}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid rgba(128,128,128,0.2)',
                borderRadius: 'var(--sf-radius, 8px)',
                overflow: 'hidden',
              }}
            >
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
              )}
              <div style={{ padding: '1rem 1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.375rem', fontFamily: 'var(--sf-font-heading)' }}>
                  {p.title}
                </h2>
                {p.published_at && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--sf-muted, #888)', marginBottom: 6 }}>
                    {new Date(p.published_at).toLocaleDateString('cs-CZ')}
                  </div>
                )}
                {p.excerpt && <p style={{ margin: 0, color: 'var(--sf-muted, #555)' }}>{p.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
