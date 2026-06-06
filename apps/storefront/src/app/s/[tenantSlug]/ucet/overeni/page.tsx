'use client';

/**
 * E-mail verification landing — opened from the welcome e-mail (?token=…).
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { customerVerifyEmail } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default function VerifyEmailPage({ params }: Props) {
  const { tenantSlug } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Ověřuji…');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Odkaz je neúplný — použijte tlačítko z e-mailu.');
      return;
    }
    customerVerifyEmail(tenantSlug, token)
      .then((msg) => {
        setState('done');
        setMessage(msg);
      })
      .catch((err) => {
        setState('error');
        setMessage((err as Error).message);
      });
  }, [tenantSlug, token]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>
        {state === 'done' ? '✓ E-mail ověřen' : state === 'error' ? 'Ověření selhalo' : 'Ověřuji…'}
      </h1>
      <p>{message}</p>
      <Link href={`/s/${tenantSlug}/ucet`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
        → Můj účet
      </Link>
    </main>
  );
}
