'use client';

/**
 * Locale switcher (per `23-i18n.md` MVP). Sets the `shopio_locale` cookie and
 * refreshes so server components re-fetch translated content.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const NAMES: Record<string, string> = {
  'cs-CZ': 'Čeština',
  'sk-SK': 'Slovenčina',
  'en-US': 'English',
  'en-GB': 'English',
  'de-DE': 'Deutsch',
  'pl-PL': 'Polski',
};

export function LocaleSwitcher({
  locales,
  current,
}: {
  locales: string[];
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!locales || locales.length < 2) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    document.cookie = `shopio_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={current}
      onChange={onChange}
      disabled={pending}
      aria-label="Jazyk"
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
      {locales.map((l) => (
        <option key={l} value={l}>
          {NAMES[l] ?? l}
        </option>
      ))}
    </select>
  );
}
