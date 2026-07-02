/**
 * Marketplace registry — resolves a platform code to its connector (mirrors the
 * carrier registry). `allegro` uses the real API (needs an access token);
 * everything else falls back to the deterministic mock.
 */

import { AllegroConnector } from './allegro';
import { MockMarketplaceConnector } from './mock';
import type { MarketplaceConnector } from './types';

export interface ConnectorOptions {
  accessToken?: string | null;
  sandbox?: boolean;
}

export function getMarketplaceConnector(platform: string, opts: ConnectorOptions = {}): MarketplaceConnector {
  if (platform === 'allegro') {
    return new AllegroConnector({ accessToken: opts.accessToken ?? null, sandbox: opts.sandbox ?? false });
  }
  return new MockMarketplaceConnector();
}

/** Catalog for the admin channel picker (platform → label + real flag). */
export const MARKETPLACE_CATALOG: { platform: string; displayName: string; real: boolean }[] = [
  { platform: 'allegro', displayName: 'Allegro', real: true },
  { platform: 'mock', displayName: 'Mock Marketplace', real: false },
];

export * from './types';
