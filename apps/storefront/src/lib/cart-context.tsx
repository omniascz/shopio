'use client';

/**
 * Cart context — keeps cart state on the client, syncs via cookie-backed API.
 * Per `26-themes-storefront.md §6` (cart UX) + `11-cart.md §RULE-CART-009` (cookie session).
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  addToCart as apiAdd,
  fetchCart,
  removeCartItem as apiRemove,
  updateCartItem as apiUpdate,
  type Cart,
} from './api';

interface CartContextValue {
  tenantSlug: string;
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  drawerOpen: boolean;
  itemCount: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchCart(tenantSlug);
      setCart(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (variantId: string, quantity = 1) => {
      setError(null);
      try {
        const updated = await apiAdd(tenantSlug, variantId, quantity);
        setCart(updated);
        setDrawerOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add item');
        throw e;
      }
    },
    [tenantSlug],
  );

  const update = useCallback(
    async (itemId: string, quantity: number) => {
      setError(null);
      try {
        const updated = await apiUpdate(tenantSlug, itemId, quantity);
        setCart(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update item');
        throw e;
      }
    },
    [tenantSlug],
  );

  const remove = useCallback(
    async (itemId: string) => {
      setError(null);
      try {
        const updated = await apiRemove(tenantSlug, itemId);
        setCart(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove item');
        throw e;
      }
    },
    [tenantSlug],
  );

  const value: CartContextValue = {
    tenantSlug,
    cart,
    loading,
    error,
    drawerOpen,
    itemCount: cart?.item_count ?? 0,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    add,
    update,
    remove,
    refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
