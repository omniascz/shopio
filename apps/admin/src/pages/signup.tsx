/**
 * Signup — first step of merchant onboarding (per `37` GTM: self-service
 * "založ si e-shop"). Creates the user account, auto-logs-in, and continues
 * to shop creation.
 */

import { useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-store';

export function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.signup({ email, password, ...(fullName && { fullName }) });
      await login(email, password);
      router.navigate({ to: '/onboarding' });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED'
          ? 'Tento e-mail je už zaregistrovaný — přihlaste se.'
          : err instanceof ApiError && err.code === 'WEAK_PASSWORD'
            ? `Slabé heslo: ${err.message}`
            : ((err as Error).message ?? 'Registrace selhala'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 600 }}>
          Založte si e-shop
        </h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#666' }}>
          Účet zdarma · žádné transakční poplatky
        </p>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Jméno a příjmení</span>
          <input
            type="text"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Heslo</span>
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            Min. 12 znaků, velká a malá písmena, číslice
          </span>
        </label>

        {error && <p style={errorStyle}>{error}</p>}

        <button type="submit" disabled={submitting} style={primaryBtnStyle(submitting)}>
          {submitting ? 'Zakládám účet…' : 'Vytvořit účet'}
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: '#666', textAlign: 'center' }}>
          Už máte účet?{' '}
          <Link to="/login" style={{ color: '#0066ff' }}>
            Přihlásit se
          </Link>
        </p>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f4f5f7',
  padding: '2rem',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: '#fff',
  padding: '2.5rem',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '1rem',
  fontSize: '0.875rem',
};

const labelTextStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  color: '#c00',
  fontSize: '0.875rem',
  margin: '0 0 1rem',
  padding: '0.5rem 0.75rem',
  background: '#fff5f5',
  border: '1px solid #ffd5d5',
  borderRadius: 4,
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.75rem',
    background: '#0066ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.9375rem',
    fontWeight: 500,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
  };
}
