/**
 * PayU provider (per `13`) — international gateway with a CZ presence.
 *
 * REST: OAuth2 client-credentials token → create order (returns redirectUri +
 * orderId) → status via GET. Per-merchant: posId (clientId) + clientSecret +
 * md5key (notification signature). Mock fallback without credentials; real flow
 * needs PayU-sandbox verification.
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
  supportedCurrencies: ['CZK', 'EUR', 'PLN', 'USD'],
  supportedMethodKinds: ['card', 'bank_transfer', 'apple_pay', 'google_pay'],
};

export function mapPayuState(state: string): PaymentStatus | null {
  switch (state.toUpperCase()) {
    case 'NEW':
    case 'PENDING':
    case 'WAITING_FOR_CONFIRMATION':
      return 'processing';
    case 'COMPLETED':
      return 'captured';
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled';
    case 'REJECTED':
      return 'failed';
    default:
      return null;
  }
}

export interface PayuCredentials {
  posId?: string;
  clientSecret?: string;
  md5key?: string;
}

export class PayuProvider implements PaymentProvider {
  readonly code = 'payu';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: PayuCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://secure.snd.payu.com' : 'https://secure.payu.com';
    this.mock = !(creds.posId && creds.clientSecret);
  }

  private async token(): Promise<string> {
    const res = await fetch(`${this.base}/pl/standard/user/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${this.creds.posId}&client_secret=${this.creds.clientSecret}`,
    });
    if (!res.ok) throw new Error(`PayU token ${res.status}`);
    const j = (await res.json()) as { access_token?: string };
    if (!j.access_token) throw new Error('PayU token missing');
    return j.access_token;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `payu_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}payu_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/api/v2_1/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      redirect: 'manual',
      body: JSON.stringify({
        customerIp: '127.0.0.1',
        merchantPosId: this.creds.posId,
        description: `Objednávka ${input.orderNumber}`,
        currencyCode: input.currency,
        totalAmount: String(Number(input.amountMinor)),
        extOrderId: input.orderNumber,
        continueUrl: input.returnUrl,
        notifyUrl: input.notificationUrl,
        buyer: { email: input.customerEmail },
        products: input.items.map((it) => ({
          name: it.title,
          unitPrice: String(Number(it.unitAmountMinor)),
          quantity: String(it.quantity),
        })),
      }),
    });
    const j = (await res.json()) as { redirectUri?: string; orderId?: string };
    if (!j.redirectUri || !j.orderId) throw new Error('PayU create missing redirectUri/orderId');
    return { providerPaymentId: j.orderId, redirectUrl: j.redirectUri, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('payu_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/api/v2_1/orders/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`PayU status ${res.status}`);
    const j = (await res.json()) as { orders?: { status?: string }[] };
    return { status: mapPayuState(j.orders?.[0]?.status ?? '') ?? 'processing', raw: j };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('payu_mock_')) {
      return { providerRefundId: `payur_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    const token = await this.token();
    await fetch(`${this.base}/api/v2_1/orders/${input.providerPaymentId}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund: { description: 'Refund', amount: String(Number(input.amountMinor)) } }),
    });
    return { providerRefundId: `payur_${input.providerPaymentId}`, status: 'processing' };
  }
}

export function createPayuProvider(creds: PayuCredentials, isTestMode: boolean): PayuProvider {
  return new PayuProvider(creds, isTestMode);
}
