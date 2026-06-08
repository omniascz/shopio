/**
 * Twisto / Skip Pay provider (per `13`) — CZ BNPL ("kup teď, zaplať později").
 *
 * REST: create an order → redirect/approval URL → status. Per-merchant: apiKey
 * + (publicKey). Mock fallback; real flow needs Twisto-sandbox verification.
 * Skip Pay (ČSOB) is structurally similar — the same adapter shape applies.
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
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['bnpl'],
};

export function mapTwistoState(state: string): PaymentStatus | null {
  switch (state.toLowerCase()) {
    case 'new':
    case 'pending':
    case 'authorized':
      return 'processing';
    case 'confirmed':
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

export interface TwistoCredentials {
  apiKey?: string;
  publicKey?: string;
}

export class TwistoProvider implements PaymentProvider {
  readonly code = 'twisto';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: TwistoCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://api.sandbox.twisto.cz' : 'https://api.twisto.cz';
    this.mock = !creds.apiKey;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `twisto_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}twisto_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/v3/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_id: input.orderNumber,
        amount: Number(input.amountMinor) / 100,
        currency: input.currency,
        customer: { email: input.customerEmail },
        return_url: input.returnUrl,
        notification_url: input.notificationUrl,
      }),
    });
    const j = (await res.json()) as { id?: string; checkout_url?: string };
    if (!j.id || !j.checkout_url) throw new Error('Twisto create missing id/checkout_url');
    return { providerPaymentId: j.id, redirectUrl: j.checkout_url, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('twisto_mock_')) {
      return { status: 'captured', methodKind: 'bnpl', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/v3/orders/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.creds.apiKey}` },
    });
    if (!res.ok) throw new Error(`Twisto status ${res.status}`);
    const j = (await res.json()) as { status?: string };
    return { status: mapTwistoState(j.status ?? '') ?? 'processing', methodKind: 'bnpl', raw: j };
  }
}

export function createTwistoProvider(creds: TwistoCredentials, isTestMode: boolean): TwistoProvider {
  return new TwistoProvider(creds, isTestMode);
}
