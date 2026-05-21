export function App() {
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
      <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Shopio Admin</h1>
      <p style={{ color: 'var(--shopio-color-fg-muted)', fontSize: '1rem' }}>
        Vite + React 19 SPA — Fáze 0 skeleton ready.
      </p>
    </main>
  );
}
