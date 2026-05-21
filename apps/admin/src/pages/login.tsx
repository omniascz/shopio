import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAuth } from '../lib/auth-store';

export function LoginPage() {
  const { login, loading, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      router.navigate({ to: '/' });
    } catch {
      // surfaced via store error
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f5f7',
        padding: '2rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          padding: '2.5rem',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
          Shopio Admin
        </h1>

        <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>E-mail</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Heslo</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && (
          <p
            style={{
              color: '#c00',
              fontSize: '0.875rem',
              margin: '0 0 1rem',
              padding: '0.5rem 0.75rem',
              background: '#fff5f5',
              border: '1px solid #ffd5d5',
              borderRadius: 4,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#0066ff',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Přihlašuji…' : 'Přihlásit'}
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#666', textAlign: 'center' }}>
          MVP režim · žádné MFA · Fáze 1 wave 2: passkey + TOTP
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
};
