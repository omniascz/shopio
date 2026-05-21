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
        fontFamily: 'var(--shopio-font-sans)',
        color: 'var(--shopio-color-fg-strong)',
        background: 'var(--shopio-color-surface-1)',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', fontWeight: 600, marginBottom: '1rem' }}>
        Shopio Storefront
      </h1>
      <p style={{ color: 'var(--shopio-color-fg-muted)', fontSize: '1.125rem' }}>
        Fáze 0 — skeleton ready. Storefront app booted.
      </p>
    </main>
  );
}
