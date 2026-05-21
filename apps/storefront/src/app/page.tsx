import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1rem',
        fontFamily: 'var(--shopio-font-sans)',
        color: 'var(--shopio-color-fg-strong)',
        background: 'var(--shopio-color-surface-1)',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Shopio Storefront
      </h1>
      <p
        style={{
          color: 'var(--shopio-color-fg-muted)',
          fontSize: '1.125rem',
          textAlign: 'center',
          maxWidth: 600,
        }}
      >
        Multi-tenant storefront. Visit a specific store via{' '}
        <code style={{ fontFamily: 'var(--shopio-font-mono)' }}>/s/&lt;tenant-slug&gt;</code>.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Link
          href="/s/bob-ceramics"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            background: 'var(--shopio-color-primary)',
            color: 'var(--shopio-color-fg-on-primary)',
            borderRadius: 'var(--shopio-radius-md)',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '1rem',
            transition: 'background var(--shopio-motion-fast)',
          }}
        >
          Browse Bob Ceramics →
        </Link>
      </div>
    </main>
  );
}
