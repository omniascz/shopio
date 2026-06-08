/**
 * Klarna provider (per `13`) — the dominant DACH/UK/Nordics BNPL + invoice
 * ("Rechnungskauf" / pay-in-30 / pay-in-3). A major conversion driver on the
 * German and UK markets.
 *
 * Flow: create a Hosted Payment Page (HPP) session → redirect → status via the
 * order/session read. Per-merchant: username + password (API credentials),
 * region-scoped base URL. Mock fallback; the real flow needs Klarna Playground
 * verification (the HPP + order-management split, capture on fulfilment).
 */

import { createHash } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatus,
  PaymentStatusResult,
  ProviderCapabilities,
} from './types';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: false,
  supportsPartialRefund: false,
  supportedCurrencies: ['EUR', 'GBP', 'SEK', 'NOK', 'DKK', 'USD', 'CHF', 'PLN'],
  supportedMethodKinds: ['bnpl'],
};

/** Klarna order/session status → our status. */
export function mapKlarnaState(state: string): PaymentStatus | null {
  switch (state.toLowerCase()) {
    case 'incomplete':
    case 'authorized':
    case 'pending':
      return 'processing';
    case 'complete':
    case 'captured':
    case 'paid':
      return 'captured';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

export interface KlarnaCredentials {
  username?: string;
  password?: string;
  /** Klarna region: 'eu' (default), 'na', 'oc'. */
  region?: string;
}

export class KlarnaProvider implements PaymentProvider {
  readonly code = 'klarna';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: KlarnaCredentials,
    isTestMode: boolean,
  ) {
    const region = creds.region === 'na' ? '-na' : creds.region === 'oc' ? '-oc' : '';
    this.base = isTestMode
      ? `https://api${region}.playground.klarna.com`
      : `https://api${region}.klarna.com`;
    this.mock = !(creds.username && creds.password);
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.creds.username}:${this.creds.password}`).toString('base64')}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `klarna_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}klarna_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    // Hosted Payment Page session (Klarna Payments + HPP).
    const res = await fetch(`${this.base}/hpp/v1/sessions`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_session_url: `${this.base}/payments/v1/sessions`,
        merchant_urls: {
          success: input.returnUrl,
          cancel: input.cancelUrl,
          back: input.cancelUrl,
          failure: input.cancelUrl,
          error: input.cancelUrl,
          status_update: input.notificationUrl,
        },
        options: { payment_method_category: 'pay_later' },
        order: {
          purchase_currency: input.currency,
          order_amount: Number(input.amountMinor),
          order_reference: input.orderNumber,
        },
      }),
    });
    const j = (await res.json()) as { session_id?: string; redirect_url?: string };
    if (!j.session_id || !j.redirect_url) throw new Error('Klarna HPP session missing id/redirect_url');
    return { providerPaymentId: j.session_id, redirectUrl: j.redirect_url, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('klarna_mock_')) {
      return { status: 'captured', methodKind: 'bnpl', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/hpp/v1/sessions/${providerPaymentId}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (!res.ok) throw new Error(`Klarna status ${res.status}`);
    const j = (await res.json()) as { status?: string };
    return { status: mapKlarnaState(j.status ?? '') ?? 'processing', methodKind: 'bnpl', raw: j };
  }
}

export function createKlarnaProvider(creds: KlarnaCredentials, isTestMode: boolean): KlarnaProvider {
  return new KlarnaProvider(creds, isTestMode);
}
