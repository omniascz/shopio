/**
 * GoPay provider (per `13 §4.2`, §11.2) — CZ/SK hosted-redirect gateway.
 *
 * Flow: OAuth2 client-credentials token → create payment → redirect the
 * customer to GoPay's `gw_url` → GoPay calls our notification URL → we fetch
 * the authoritative status (GoPay notifications carry no signature; the status
 * fetch IS the verification). States map to our lifecycle in `mapGopayState`.
 *
 * Mock fallback: with no real credentials (goId/clientId/clientSecret) the
 * provider runs deterministically (mock gw_url + payment id) — same posture as
 * the Stripe/Packeta mocks, so dev/CI can exercise the full flow. A test-mode
 * config without credentials is allowed and uses the mock; production requires
 * real credentials (enforced where the provider is configured).
 */

import { createHash } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentEvent,
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
  supportedCurrencies: ['CZK', 'EUR', 'PLN', 'USD', 'GBP', 'HUF', 'RON', 'BGN'],
  supportedMethodKinds: ['card', 'bank_transfer', 'apple_pay', 'google_pay'],
};

/** GoPay payment state → our provider-neutral status (§11.2). */
export function mapGopayState(state: string): PaymentStatus | null {
  switch (state) {
    case 'CREATED':
    case 'PAYMENT_METHOD_CHOSEN':
      return 'processing';
    case 'AUTHORIZED':
      return 'authorized';
    case 'PAID':
      return 'captured';
    case 'PARTIALLY_REFUNDED':
      return 'partially_refunded';
    case 'REFUNDED':
      return 'refunded';
    case 'CANCELED':
      return 'cancelled';
    case 'TIMEOUTED':
      return 'expired';
    default:
      return null;
  }
}

export interface GopayCredentials {
  goId?: string;
  clientId?: string;
  clientSecret?: string;
}

export class GopayProvider implements PaymentProvider {
  readonly code = 'gopay';
  readonly capabilities = CAPABILITIES;

  private readonly baseUrl: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: GopayCredentials,
    private readonly isTestMode: boolean,
  ) {
    this.baseUrl = isTestMode
      ? 'https://gw.sandbox.gopay.com'
      : 'https://gate.gopay.cz';
    this.mock = !(creds.goId && creds.clientId && creds.clientSecret);
  }

  // --- OAuth2 client-credentials token ------------------------------------
  private async getToken(scope = 'payment-create'): Promise<string> {
    const basic = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(`${this.baseUrl}/api/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: `grant_type=client_credentials&scope=${scope}`,
    });
    if (!res.ok) throw new Error(`GoPay token failed: ${res.status}`);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('GoPay token missing access_token');
    return json.access_token;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      // Deterministic mock id derived from the order — stable across retries.
      const id = `gp_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}gopay_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }

    const token = await this.getToken('payment-create');
    const body = {
      payer: {
        contact: { email: input.customerEmail },
      },
      target: { type: 'ACCOUNT', goid: this.creds.goId },
      amount: Number(input.amountMinor),
      currency: input.currency,
      order_number: input.orderNumber,
      order_description: `Objednávka ${input.orderNumber}`,
      items: [
        ...input.items.map((it) => ({
          name: it.title,
          amount: Number(it.unitAmountMinor) * it.quantity,
          count: it.quantity,
        })),
        ...(input.shippingAmountMinor && input.shippingAmountMinor > 0n
          ? [
              {
                name: input.shippingLabel ?? 'Doprava',
                amount: Number(input.shippingAmountMinor),
                count: 1,
              },
            ]
          : []),
      ],
      callback: {
        return_url: input.returnUrl,
        notification_url: input.notificationUrl,
      },
      lang: 'CS',
    };
    const res = await fetch(`${this.baseUrl}/api/payments/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GoPay create failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { id?: number | string; gw_url?: string; state?: string };
    if (!json.id || !json.gw_url) throw new Error('GoPay create missing id/gw_url');
    return {
      providerPaymentId: String(json.id),
      redirectUrl: json.gw_url,
      status: mapGopayState(json.state ?? 'CREATED') ?? 'processing',
      raw: { state: json.state },
    };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('gp_mock_')) {
      // Mock: the customer "returned" → treat as paid.
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const token = await this.getToken('payment-all');
    const res = await fetch(`${this.baseUrl}/api/payments/payment/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`GoPay status failed: ${res.status}`);
    const json = (await res.json()) as {
      state?: string;
      payment_instrument?: string;
    };
    return {
      status: mapGopayState(json.state ?? '') ?? 'processing',
      methodKind: json.payment_instrument ?? null,
      raw: json,
    };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('gp_mock_')) {
      return { providerRefundId: `gpr_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    const token = await this.getToken('payment-all');
    const res = await fetch(
      `${this.baseUrl}/api/payments/payment/${input.providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: `amount=${Number(input.amountMinor)}`,
      },
    );
    if (!res.ok) throw new Error(`GoPay refund failed: ${res.status}`);
    const json = (await res.json()) as { id?: number | string; result?: string };
    return {
      providerRefundId: String(json.id ?? input.idempotencyKey),
      status: json.result === 'FINISHED' ? 'succeeded' : 'processing',
    };
  }

  /**
   * GoPay notifications are an unauthenticated GET to the notification URL
   * carrying `?id=`. Authenticity is established by fetching the status from
   * GoPay (done by the webhook handler), so we accept the ping and let the
   * handler reconcile — there is no signature to verify.
   */
  parseWebhookEvent(
    _payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPaymentEvent | null {
    const id = headers['x-gopay-payment-id'];
    const paymentId = typeof id === 'string' ? id : null;
    if (!paymentId) return null;
    return {
      eventId: `gopay_${paymentId}_notify`,
      eventType: 'gopay.notification',
      providerPaymentId: paymentId,
      status: null, // handler fetches authoritative status via getStatus
    };
  }
}

export function createGopayProvider(
  creds: GopayCredentials,
  isTestMode: boolean,
): GopayProvider {
  return new GopayProvider(creds, isTestMode);
}
