'use client';

/**
 * "Koupit znovu" (P3 reorder) — re-adds a past order's items to the cart and
 * sends the customer to checkout.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reorder } from '@/lib/api';

export function ReorderButton({ tenantSlug, orderNumber }: { tenantSlug: string; orderNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const r = await reorder(tenantSlug, orderNumber);
    setBusy(false);
    if (r.ok && r.added > 0) router.push(`/s/${tenantSlug}/checkout`);
    else if (r.ok) alert('Položky z této objednávky už nejsou dostupné.');
    else alert('Nepodařilo se zopakovat objednávku.');
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        padding: '0.4rem 0.75rem',
        fontSize: '0.8125rem',
        border: '1px solid rgba(128,128,128,0.4)',
        borderRadius: 6,
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      {busy ? '…' : '↻ Koupit znovu'}
    </button>
  );
}
