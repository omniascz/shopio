/**
 * TrustPay provider (per `13`) — SK-origin gateway (CZ/SK/EU), bank transfers +
 * cards. OAuth2 (projectId + secret) → create payment (GatewayUrl) → status.
 * Per-merchant: projectId + secret. Mock fallback; real flow needs the TrustPay
 * sandbox verified.
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
  supportedCurrencies: ['EUR', 'CZK', 'PLN', 'HUF', 'GBP', 'USD'],
  supportedMethodKinds: ['card', 'bank_transfer'],
};

/** TrustPay payment result/status → our status. */
export function mapTrustpayStatus(status: string): PaymentStatus | null {
  switch (status.toLowerCase()) {
    case 'created':
    case 'pending':
    case 'authorized':
      return 'processing';
    case 'paid':
    case 'captured':
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

export interface TrustpayCredentials {
  projectId?: string;
  secret?: string;
}

export class TrustpayProvider implements PaymentProvider {
  readonly code = 'trustpay';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: TrustpayCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://amapi.test.trustpay.eu' : 'https://amapi.trustpay.eu';
    this.mock = !(creds.projectId && creds.secret);
  }

  private async token(): Promise<string> {
    const basic = Buffer.from(`${this.creds.projectId}:${this.creds.secret}`).toString('base64');
    const res = await fetch(`${this.base}/api/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`TrustPay token ${res.status}`);
    const j = (await res.json()) as { access_token?: string };
    if (!j.access_token) throw new Error('TrustPay token missing');
    return j.access_token;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `trp_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}trustpay_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/api/Payments/Payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        PaymentMethod: 'Card',
        MerchantIdentification: { ProjectId: this.creds.projectId },
        PaymentInformation: {
          Amount: { Amount: (Number(input.amountMinor) / 100).toFixed(2), Currency: input.currency },
          References: { MerchantReference: input.orderNumber },
        },
        CallbackUrls: { Success: input.returnUrl, Cancel: input.cancelUrl, Error: input.cancelUrl },
        Notification: { Url: input.notificationUrl },
      }),
    });
    const j = (await res.json()) as { GatewayUrl?: string; PaymentRequestId?: string };
    if (!j.GatewayUrl || !j.PaymentRequestId) throw new Error('TrustPay create missing GatewayUrl/id');
    return { providerPaymentId: j.PaymentRequestId, redirectUrl: j.GatewayUrl, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('trp_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const token = await this.token();
    const res = await fetch(`${this.base}/api/Payments/Payment/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`TrustPay status ${res.status}`);
    const j = (await res.json()) as { Status?: string };
    return { status: mapTrustpayStatus(j.Status ?? '') ?? 'processing', raw: j };
  }
}

export function createTrustpayProvider(
  creds: TrustpayCredentials,
  isTestMode: boolean,
): TrustpayProvider {
  return new TrustpayProvider(creds, isTestMode);
}
