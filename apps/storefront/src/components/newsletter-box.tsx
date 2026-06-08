'use client';

import { useState } from 'react';
import { subscribeNewsletter } from '@/lib/api';

export function NewsletterBox({ tenantSlug }: { tenantSlug: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setState('sending');
    const ok = await subscribeNewsletter(tenantSlug, email);
    setState(ok ? 'done' : 'error');
    if (ok) setEmail('');
  }

  if (state === 'done') {
    return <p style={{ fontSize: '0.875rem', color: 'var(--shopio-color-fg-default)' }}>Děkujeme! Odběr potvrzen.</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: 420 }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Váš e-mail"
        required
        style={{
          flex: 1,
          minWidth: 180,
          padding: '0.55rem 0.75rem',
          border: '1px solid var(--shopio-color-border-default)',
          borderRadius: 'var(--shopio-radius-sm, 4px)',
          fontSize: '0.875rem',
        }}
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        style={{
          padding: '0.55rem 1.1rem',
          background: 'var(--shopio-color-accent, #111)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--shopio-radius-sm, 4px)',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        {state === 'sending' ? 'Odesílám…' : 'Odebírat'}
      </button>
      {state === 'error' && <span style={{ fontSize: '0.8125rem', color: '#c00' }}>Zkuste to znovu.</span>}
    </form>
  );
}
