'use client';

/**
 * Currency switcher (P1). Sets the `shopio_currency` cookie and refreshes so
 * server components re-fetch prices converted via ČNB FX.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function CurrencySwitcher({ currencies, current }: { currencies: string[]; current: string | undefined }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!currencies || currencies.length < 2) return null;
  const value = current && currencies.includes(current) ? current : currencies[0];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    document.cookie = `shopio_currency=${e.target.value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={pending}
      aria-label="Měna"
      style={{
        background: 'transparent',
        color: 'inherit',
        border: '1px solid rgba(128,128,128,0.4)',
        borderRadius: 4,
        padding: '0.25rem 0.5rem',
        fontSize: '0.8125rem',
        cursor: 'pointer',
      }}
    >
      {currencies.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
