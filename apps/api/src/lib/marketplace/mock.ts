/**
 * Deterministic mock marketplace connector — lets the whole list/sync flow run
 * in dev/CI without any external account (mirrors the mock carrier/payment
 * providers). Offer ids are stable per SKU/title so re-listing is idempotent.
 */

import type { ExternalOrder, MarketplaceConnector, OfferInput, OfferResult } from './types';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'offer';
}

export class MockMarketplaceConnector implements MarketplaceConnector {
  readonly platform = 'mock';
  readonly displayName = 'Mock Marketplace';
  readonly real = false;

  async listOffer(input: OfferInput): Promise<OfferResult> {
    return { externalOfferId: `mock-${slug(input.sku ?? input.title)}`, status: 'active' };
  }
  async updateStock(): Promise<void> {}
  async updatePrice(): Promise<void> {}
  async endOffer(): Promise<void> {}
  async fetchOrders(): Promise<ExternalOrder[]> {
    return [];
  }
}
