/**
 * Alma provider (per `13`) — the leading French BNPL ("paiement en plusieurs
 * fois" — pay in 2/3/4 instalments). A standard checkout option on the FR
 * market alongside Carte Bancaire.
 *
 * Flow: create a payment → redirect to Alma's page → status via the payment
 * read. Per-merchant: api_key (live/test). Mock fallback; the real flow needs
 * Alma-sandbox verification.
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
  supportedCurrencies: ['EUR'],
  supportedMethodKinds: ['bnpl'],
};

/** Alma payment state → our status. */
export function mapAlmaState(state: string): PaymentStatus | null {
  switch (state.toLowerCase()) {
    case 'not_started':
    case 'in_progress':
    case 'scored_no':
    case 'scored_yes':
      return 'processing';
    case 'paid':
    case 'in_progress_paid':
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

export interface AlmaCredentials {
  apiKey?: string;
}

export class AlmaProvider implements PaymentProvider {
  readonly code = 'alma';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: AlmaCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://api.sandbox.getalma.eu' : 'https://api.getalma.eu';
    this.mock = !creds.apiKey;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `alma_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}alma_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/v1/payments`, {
      method: 'POST',
      headers: { Authorization: `Alma-Auth ${this.creds.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: {
          purchase_amount: Number(input.amountMinor),
          installments_count: 3,
          return_url: input.returnUrl,
          ipn_callback_url: input.notificationUrl,
          customer_cancel_url: input.cancelUrl,
          custom_data: { order_number: input.orderNumber },
        },
        customer: { email: input.customerEmail },
      }),
    });
    const j = (await res.json()) as { id?: string; url?: string };
    if (!j.id || !j.url) throw new Error('Alma create missing id/url');
    return { providerPaymentId: j.id, redirectUrl: j.url, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('alma_mock_')) {
      return { status: 'captured', methodKind: 'bnpl', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Alma-Auth ${this.creds.apiKey}` },
    });
    if (!res.ok) throw new Error(`Alma status ${res.status}`);
    const j = (await res.json()) as { state?: string };
    return { status: mapAlmaState(j.state ?? '') ?? 'processing', methodKind: 'bnpl', raw: j };
  }
}

export function createAlmaProvider(creds: AlmaCredentials, isTestMode: boolean): AlmaProvider {
  return new AlmaProvider(creds, isTestMode);
}
