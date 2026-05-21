import { useEffect } from 'react';
import { AppRouter } from './router';
import { useAuth } from './lib/auth-store';

export function App() {
  const { init, loading } = useAuth();

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '0.875rem',
        }}
      >
        Načítání…
      </main>
    );
  }

  return <AppRouter />;
}
