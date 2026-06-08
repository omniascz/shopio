'use client';

/**
 * Wishlist + compare — client-only, per `19` (no PII, instant). State lives in
 * localStorage keyed per tenant so multiple shops on one browser stay
 * separate. Stores lightweight product snapshots so the compare/wishlist
 * views render without extra fetches.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { wishlistAdd, wishlistList, wishlistRemove } from '@/lib/api';

export interface SavedProduct {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
}

interface CompareState {
  wishlist: SavedProduct[];
  compare: SavedProduct[];
  toggleWishlist: (p: SavedProduct) => void;
  toggleCompare: (p: SavedProduct) => void;
  isWished: (id: string) => boolean;
  isCompared: (id: string) => boolean;
  clearCompare: () => void;
}

const COMPARE_MAX = 4;
const Ctx = createContext<CompareState | null>(null);

export function CompareProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const wishKey = `shopio.wishlist.${tenantSlug}`;
  const cmpKey = `shopio.compare.${tenantSlug}`;
  const [wishlist, setWishlist] = useState<SavedProduct[]>([]);
  const [compare, setCompare] = useState<SavedProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setWishlist(JSON.parse(localStorage.getItem(wishKey) ?? '[]'));
      setCompare(JSON.parse(localStorage.getItem(cmpKey) ?? '[]'));
    } catch {
      // corrupt storage → start clean
    }
    setReady(true);
  }, [wishKey, cmpKey]);

  useEffect(() => {
    if (ready) localStorage.setItem(wishKey, JSON.stringify(wishlist));
  }, [wishlist, ready, wishKey]);

  // Server-side wishlist (P2): when logged in, merge the cross-device list into
  // the local one (best-effort; 401 for guests → no-op).
  useEffect(() => {
    let active = true;
    void wishlistList(tenantSlug).then((items) => {
      if (!active || items.length === 0) return;
      setWishlist((prev) => {
        const byId = new Map(prev.map((x) => [x.id, x]));
        for (const it of items) {
          if (!byId.has(it.id)) {
            byId.set(it.id, {
              id: it.id,
              slug: it.slug,
              title: it.title,
              image: it.primary_image?.url ?? null,
              priceAmount: it.base_price?.amount ?? null,
              priceCurrency: it.base_price?.currency ?? null,
            });
          }
        }
        return [...byId.values()];
      });
    });
    return () => {
      active = false;
    };
  }, [tenantSlug]);
  useEffect(() => {
    if (ready) localStorage.setItem(cmpKey, JSON.stringify(compare));
  }, [compare, ready, cmpKey]);

  const toggleWishlist = useCallback(
    (p: SavedProduct) => {
      setWishlist((prev) => {
        if (prev.some((x) => x.id === p.id)) {
          void wishlistRemove(tenantSlug, p.id); // persist when logged in
          return prev.filter((x) => x.id !== p.id);
        }
        void wishlistAdd(tenantSlug, p.id);
        return [...prev, p];
      });
    },
    [tenantSlug],
  );

  const toggleCompare = useCallback((p: SavedProduct) => {
    setCompare((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev.filter((x) => x.id !== p.id);
      if (prev.length >= COMPARE_MAX) return prev; // cap; UI shows the limit
      return [...prev, p];
    });
  }, []);

  const isWished = useCallback((id: string) => wishlist.some((x) => x.id === id), [wishlist]);
  const isCompared = useCallback((id: string) => compare.some((x) => x.id === id), [compare]);
  const clearCompare = useCallback(() => setCompare([]), []);

  return (
    <Ctx.Provider
      value={{ wishlist, compare, toggleWishlist, toggleCompare, isWished, isCompared, clearCompare }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCompare(): CompareState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}

export const COMPARE_LIMIT = COMPARE_MAX;
