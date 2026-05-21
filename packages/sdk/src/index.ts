/**
 * Shopio SDK — official TypeScript client for the Shopio API.
 *
 * Per `28-developer-platform.md §6`. MIT-licensed (distinct from Apache 2.0 core).
 *
 * @example
 * ```ts
 * import { Shopio } from '@shopio/sdk';
 *
 * const sho = new Shopio({
 *   apiKey: process.env.SHOPIO_API_KEY,
 *   tenantId: 'tnt_aB',
 *   apiVersion: '2026-05-20',
 * });
 *
 * const product = await sho.products.get('prd_aB');
 * ```
 */

export type ShopioConfig = {
  apiKey?: string;
  oauth?: {
    clientId: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string }) => void;
  };
  tenantId: string;
  apiVersion: string;
  baseUrl?: string;
};

export class Shopio {
  constructor(public readonly config: ShopioConfig) {
    if (!config.apiKey && !config.oauth?.accessToken) {
      throw new Error('Shopio: apiKey or oauth.accessToken required');
    }
  }

  // Resource clients (skeleton — populated as domains land)
  // products, orders, customers, ...

  // GraphQL client
  async graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    void query;
    void variables;
    throw new Error('Shopio.graphql: not implemented yet');
  }
}

export * from './errors.js';
