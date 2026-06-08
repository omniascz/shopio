import { notFound } from 'next/navigation';
import { getCollection } from '@/lib/api';
import { ProductCardRow } from '@/components/product-card-row';

interface Props {
  params: Promise<{ tenantSlug: string; slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const col = await getCollection(tenantSlug, slug);
  return { title: col?.name ?? 'Kolekce' };
}

export default async function CollectionPage({ params }: Props) {
  const { tenantSlug, slug } = await params;
  const col = await getCollection(tenantSlug, slug);
  if (!col) notFound();

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>{col.name}</h1>
      {col.description && (
        <p style={{ color: 'var(--shopio-color-fg-muted)', marginBottom: '1.5rem' }}>{col.description}</p>
      )}
      {col.products.length === 0 ? (
        <p style={{ color: 'var(--shopio-color-fg-muted)' }}>V této kolekci zatím nejsou žádné produkty.</p>
      ) : (
        <ProductCardRow tenantSlug={tenantSlug} products={col.products} />
      )}
    </main>
  );
}
