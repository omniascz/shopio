'use client';

/**
 * Password reset landing — opened from the e-mailed link (?token=…).
 */

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { customerResetPassword } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default function PasswordResetPage({ params }: Props) {
  const { tenantSlug } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Hesla se neshodují.');
      return;
    }
    setBusy(true);
    try {
      const message = await customerResetPassword(tenantSlug, { token, password });
      setDone(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main style={pageStyle}>
        <h1 style={headingStyle}>Obnova hesla</h1>
        <p>Odkaz je neúplný — použijte tlačítko z e-mailu.</p>
        <Link href={`/s/${tenantSlug}/ucet`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
          ← Zpět na přihlášení
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main style={pageStyle}>
        <h1 style={headingStyle}>✓ Hotovo</h1>
        <p>{done}</p>
        <Link href={`/s/${tenantSlug}/ucet`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
          Přihlásit se →
        </Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={headingStyle}>Nastavení nového hesla</h1>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ maxWidth: 380 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Nové heslo</span>
          <input
            type="password"
            required
            minLength={12}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--sf-muted, #888)' }}>Min. 12 znaků</span>
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Heslo znovu</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0 0 1rem' }}>{error}</p>}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--sf-accent, #111)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Ukládám…' : 'Nastavit heslo'}
        </button>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '2rem',
};

const headingStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  margin: '0 0 1.5rem',
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
  border: '1px solid rgba(128,128,128,0.4)',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
  background: 'transparent',
  color: 'inherit',
};
