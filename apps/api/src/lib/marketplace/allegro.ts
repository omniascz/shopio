/**
 * Allegro connector (REAL) — wraps the Allegro REST API behind
 * `MarketplaceConnector`. The request shapes are built by the pure mappers in
 * `mapping.ts`; this file only does auth + transport.
 *
 * CREDENTIAL-GATED: every call needs a valid OAuth access token. Without one the
 * connector throws `MarketplaceNotConfiguredError` — so the mock-backed flow and
 * all mapping logic are verifiable now, and going live only needs a token from
 * the Allegro OAuth flow (device/authorization-code) + sandbox account.
 *
 * Token acquisition/refresh + storage (via `lib/secrets`) is the next increment;
 * this adapter accepts an already-obtained access token.
 */

import {
  fromAllegroOrder,
  toAllegroOfferPayload,
  toAllegroPriceCommand,
  toAllegroStockCommand,
} from './mapping';
import {
  MarketplaceNotConfiguredError,
  type ExternalOrder,
  type MarketplaceConnector,
  type OfferInput,
  type OfferResult,
} from './types';

const ALLEGRO_API = 'https://api.allegro.pl';
const ALLEGRO_SANDBOX_API = 'https://api.allegro.pl.allegrosandbox.pl';
const ACCEPT = 'application/vnd.allegro.public.v1+json';

export interface AllegroOptions {
  accessToken?: string | null;
  sandbox?: boolean;
}

export class AllegroConnector implements MarketplaceConnector {
  readonly platform = 'allegro';
  readonly displayName = 'Allegro';
  readonly real = true;

  constructor(private readonly opts: AllegroOptions = {}) {}

  private base(): string {
    return this.opts.sandbox ? ALLEGRO_SANDBOX_API : ALLEGRO_API;
  }
  private token(): string {
    if (!this.opts.accessToken) throw new MarketplaceNotConfiguredError('allegro');
    return this.opts.accessToken;
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${this.token()}`,
        accept: ACCEPT,
        ...(body ? { 'content-type': ACCEPT } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(`${this.base()}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Allegro ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async listOffer(input: OfferInput): Promise<OfferResult> {
    const created = await this.req('POST', '/sale/product-offers', toAllegroOfferPayload(input));
    return { externalOfferId: String(created?.id ?? ''), status: 'active' };
  }
  async updateStock(externalOfferId: string, stock: number): Promise<void> {
    await this.req('PATCH', `/sale/product-offers/${externalOfferId}`, toAllegroStockCommand(stock));
  }
  async updatePrice(externalOfferId: string, priceMinor: bigint, currency: string): Promise<void> {
    await this.req('PATCH', `/sale/product-offers/${externalOfferId}`, toAllegroPriceCommand(priceMinor, currency));
  }
  async endOffer(externalOfferId: string): Promise<void> {
    // Ending an offer = publication command with action END.
    await this.req('PUT', `/sale/offer-publication-commands/${crypto.randomUUID()}`, {
      publication: { action: 'END' },
      offerCriteria: [{ offers: [{ id: externalOfferId }], type: 'CONTAINS_OFFERS' }],
    });
  }
  async fetchOrders(sinceIso: string): Promise<ExternalOrder[]> {
    const q = `?lineItems.boughtAt.gte=${encodeURIComponent(sinceIso)}`;
    const data = await this.req('GET', `/order/checkout-forms${q}`);
    return (data?.checkoutForms ?? []).map(fromAllegroOrder);
  }
}
