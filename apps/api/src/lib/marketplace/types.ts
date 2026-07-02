/**
 * Marketplace connector abstraction (BaseLinker-style) — mirrors the carrier /
 * payment provider pattern. The listing/sync flow talks to a marketplace only
 * through `MarketplaceConnector`, so adding Amazon/Kaufland later doesn't touch
 * the routes. A `real` connector calls a live API (Allegro); the `mock`
 * connector is deterministic and fully usable in dev/CI without credentials.
 */

export interface OfferInput {
  sku: string | null;
  ean: string | null;
  title: string;
  descriptionHtml: string;
  priceMinor: bigint;
  currency: string;
  stock: number;
  images: string[];
  categoryHint?: string | null;
}

export interface OfferResult {
  externalOfferId: string;
  status: 'active' | 'draft' | 'error';
}

export interface ExternalOrderLine {
  externalOfferId: string;
  sku: string | null;
  quantity: number;
  unitPriceMinor: bigint;
}

export interface ExternalOrder {
  externalOrderId: string;
  placedAt: string;
  currency: string;
  buyerEmail: string | null;
  totalMinor: bigint;
  lines: ExternalOrderLine[];
}

export interface MarketplaceConnector {
  readonly platform: string;
  readonly displayName: string;
  readonly real: boolean;
  listOffer(input: OfferInput): Promise<OfferResult>;
  updateStock(externalOfferId: string, stock: number): Promise<void>;
  updatePrice(externalOfferId: string, priceMinor: bigint, currency: string): Promise<void>;
  endOffer(externalOfferId: string): Promise<void>;
  fetchOrders(sinceIso: string): Promise<ExternalOrder[]>;
}

/** Thrown by a real connector when its credentials are missing/expired. */
export class MarketplaceNotConfiguredError extends Error {
  constructor(public readonly platform: string) {
    super(`Marketplace ${platform} is not connected (missing credentials)`);
    this.name = 'MarketplaceNotConfiguredError';
  }
}
