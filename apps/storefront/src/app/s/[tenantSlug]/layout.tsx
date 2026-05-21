import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTenant } from '@/lib/api';
import { CartProvider } from '@/lib/cart-context';
import { CartDrawer } from '@/components/cart-drawer';
import { CartButton } from '@/components/cart-button';

interface Props {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantLayout({ children, params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  return (
    <CartProvider tenantSlug={tenantSlug}>
      <div
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 40,
        }}
      >
        <CartButton />
      </div>
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
