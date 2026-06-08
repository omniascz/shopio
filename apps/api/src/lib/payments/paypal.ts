/**
 * PayPal provider (per `13`) — global wallet + card (PayPal Orders v2 REST).
 *
 * OAuth2 client-credentials → create order (approve link) → capture/status.
 * Per-merchant: clientId + clientSecret. Mock fallback; real flow needs
 * PayPal-sandbox verification.
 */

import { createHash } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatus,
  PaymentStatusResult,
  ProviderCapabilities,
  ProviderRefundInput,
  ProviderRefundResult,
} from './types';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: true,
  supportsPartialRefund: true,
  supportedCurrencies: ['EUR', 'USD', 'GBP', 'CZK'],
  supportedMethodKinds: ['paypal', 'card'],
};

export function mapPaypalStatus(status: string): PaymentStatus | null {
  switch (status.toUpperCase()) {
    case 'CREATED':
    case 'SAVED':
    case 'APPROVED':
    case 'PAYER_ACTION_REQUIRED':
      return 'processing';
    case 'COMPLETED':
    case 'CAPTURED':
      return 'captured';
    case 'VOIDED':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return null;
  }
}

export interface PaypalCredentials {
  clientId?: string;
  clientSecret?: string;
}

export class PaypalProvider implements PaymentProvider {
  readonly code = 'paypal';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: PaypalCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    this.mock = !(creds.clientId && creds.clientSecret);
  }

  private async token(): Promise<string> {
    const basic = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString('base64');
    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal token ${res.status}`);
    const j = (await res.json()) as { access_token?: string };
    if (!j.access_token) throw new Error('PayPal token missing');
    return j.access_token;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `pp_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}paypal_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: input.orderNumber,
            amount: {
              currency_code: input.currency,
              value: (Number(input.amountMinor) / 100).toFixed(2),
            },
          },
        ],
        application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl },
      }),
    });
    const j = (await res.json()) as { id?: string; links?: { rel: string; href: string }[] };
    const approve = j.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href;
    if (!j.id || !approve) throw new Error('PayPal create missing id/approve link');
    return { providerPaymentId: j.id, redirectUrl: approve, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('pp_mock_')) {
      return { status: 'captured', methodKind: 'paypal', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/v2/checkout/orders/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`PayPal status ${res.status}`);
    const j = (await res.json()) as { status?: string };
    return { status: mapPaypalStatus(j.status ?? '') ?? 'processing', methodKind: 'paypal', raw: j };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('pp_mock_')) {
      return { providerRefundId: `ppr_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    // Refund is on the capture id; the order's capture must be resolved first
    // (deferred to sandbox verification). MVP marks processing.
    return { providerRefundId: `ppr_${input.providerPaymentId}`, status: 'processing' };
  }
}

export function createPaypalProvider(creds: PaypalCredentials, isTestMode: boolean): PaypalProvider {
  return new PaypalProvider(creds, isTestMode);
}
