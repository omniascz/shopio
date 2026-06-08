/**
 * ThePay provider (per `13 §4.2`) — CZ hosted-redirect gateway (ThePay v2 API).
 *
 * Per-merchant model: the merchant enters their merchantId + apiPassword +
 * projectId; money settles to their ThePay account, Shopio only orchestrates.
 *
 * The real v2 path follows ThePay's documented shape (create → pay_url, status,
 * refund, HMAC signature header) but, like every gateway here, must be verified
 * against the ThePay sandbox before live use. Mock fallback (no credentials)
 * exercises the full flow in dev/CI.
 */

import { createHash, createHmac } from 'node:crypto';
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
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['card', 'bank_transfer', 'apple_pay', 'google_pay'],
};

/** ThePay v2 payment state → our provider-neutral status. */
export function mapThepayState(state: string): PaymentStatus | null {
  switch (state.toLowerCase()) {
    case 'created':
    case 'waiting_for_payment':
      return 'processing';
    case 'paid':
      return 'captured';
    case 'partially_refunded':
      return 'partially_refunded';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

export interface ThepayCredentials {
  merchantId?: string;
  apiPassword?: string;
  projectId?: string;
}

export class ThepayProvider implements PaymentProvider {
  readonly code = 'thepay';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: ThepayCredentials,
    private readonly isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://demo.api.thepay.cz/v2' : 'https://api.thepay.cz/v2';
    this.mock = !(creds.merchantId && creds.apiPassword && creds.projectId);
  }

  /** ThePay v2 signs requests with HMAC-SHA256 over the body using apiPassword. */
  private sign(body: string): string {
    return createHmac('sha256', this.creds.apiPassword!).update(body).digest('hex');
  }

  private async req(
    method: 'GET' | 'POST',
    path: string,
    body?: object,
  ): Promise<Record<string, unknown>> {
    const payload = body ? JSON.stringify(body) : '';
    const res = await fetch(`${this.base}/projects/${this.creds.projectId}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        SignatureType: 'hmac',
        Signature: this.sign(payload),
        MerchantId: this.creds.merchantId!,
      },
      ...(body ? { body: payload } : {}),
    });
    if (!res.ok) throw new Error(`ThePay ${path} HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `tp_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}thepay_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const data = await this.req('POST', '/payments', {
      amount: Number(input.amountMinor),
      currency_code: input.currency,
      order_id: input.orderNumber,
      description_for_merchant: `Objednávka ${input.orderNumber}`,
      customer: { email: input.customerEmail },
      return_url: input.returnUrl,
      notif_url: input.notificationUrl,
    });
    const uid = data.uid as string | undefined;
    const payUrl = data.pay_url as string | undefined;
    if (!uid || !payUrl) throw new Error('ThePay create missing uid/pay_url');
    return { providerPaymentId: uid, redirectUrl: payUrl, status: 'processing', raw: data };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('tp_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const data = await this.req('GET', `/payments/${providerPaymentId}`);
    return {
      status: mapThepayState(String(data.state ?? '')) ?? 'processing',
      methodKind: (data.payment_method as string) ?? null,
      raw: data,
    };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('tp_mock_')) {
      return { providerRefundId: `tpr_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    await this.req('POST', `/payments/${input.providerPaymentId}/refund`, {
      amount: Number(input.amountMinor),
    });
    return { providerRefundId: `tpr_${input.providerPaymentId}`, status: 'succeeded' };
  }

  parseWebhookEvent(payload: unknown): NormalizedPaymentEvent | null {
    const p = (payload ?? {}) as { uid?: string; payment_uid?: string };
    const id = p.uid ?? p.payment_uid;
    if (!id) return null;
    return {
      eventId: `thepay_${id}_notify`,
      eventType: 'thepay.notification',
      providerPaymentId: id,
      status: null,
    };
  }
}

export function createThepayProvider(
  creds: ThepayCredentials,
  isTestMode: boolean,
): ThepayProvider {
  return new ThepayProvider(creds, isTestMode);
}
