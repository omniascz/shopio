import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollections, getTenant } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default async function CollectionsPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();
  const collections = await getCollections(tenantSlug);

  return (
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>Kolekce</h1>
      {collections.length === 0 ? (
        <p style={{ color: 'var(--shopio-color-fg-muted)' }}>Zatím žádné kolekce.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/s/${tenantSlug}/kolekce/${c.slug}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--shopio-color-border-default)',
                borderRadius: 'var(--shopio-radius-md, 8px)',
                padding: '1.25rem',
                background: 'var(--shopio-color-surface-1)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{c.name}</div>
              {c.description && (
                <div style={{ fontSize: '0.875rem', color: 'var(--shopio-color-fg-muted)', marginTop: '0.375rem' }}>{c.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
