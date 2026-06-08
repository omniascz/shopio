/**
 * Besteron provider (per `13`) — CZ/SK gateway (signed-redirect).
 *
 * Build a signed redirect to the Besteron gateway; the return/notification
 * carries the result + a signature. Per-merchant: merchantId + apiKey. Mock
 * fallback; real signing/flow needs Besteron-sandbox verification.
 */

import { createHmac } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentEvent,
  PaymentProvider,
  PaymentStatus,
  ProviderCapabilities,
} from './types';

const GATEWAY = 'https://gateway.besteron.com/pay';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: false,
  supportsPartialRefund: false,
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['card', 'bank_transfer'],
};

export function mapBesteronState(state: string): PaymentStatus | null {
  switch (state.toUpperCase()) {
    case 'OK':
    case 'PAID':
      return 'captured';
    case 'PENDING':
      return 'processing';
    case 'FAIL':
    case 'FAILED':
      return 'failed';
    case 'CANCEL':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return null;
  }
}

export interface BesteronCredentials {
  merchantId?: string;
  apiKey?: string;
}

export class BesteronProvider implements PaymentProvider {
  readonly code = 'besteron';
  readonly capabilities = CAPABILITIES;
  private readonly mock: boolean;

  constructor(private readonly creds: BesteronCredentials, _isTestMode: boolean) {
    this.mock = !(creds.merchantId && creds.apiKey);
  }

  private sign(data: string): string {
    return createHmac('sha256', this.creds.apiKey!).update(data).digest('hex');
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}besteron_mock=1&id=${encodeURIComponent(input.orderNumber)}`;
      return { providerPaymentId: input.orderNumber, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const params: Record<string, string> = {
      MID: this.creds.merchantId!,
      AMT: String(Number(input.amountMinor)),
      CURR: input.currency,
      VS: input.orderNumber.replace(/\D/g, '').slice(0, 10),
      EMAIL: input.customerEmail,
      RURL: input.returnUrl,
    };
    params.SIGN = this.sign(Object.values(params).join('|'));
    return {
      providerPaymentId: input.orderNumber,
      redirectUrl: `${GATEWAY}?${new URLSearchParams(params).toString()}`,
      status: 'processing',
      raw: { signed: true },
    };
  }

  parseWebhookEvent(payload: unknown): NormalizedPaymentEvent | null {
    const p = (payload ?? {}) as Record<string, string>;
    const orderNo = p.VS ?? p.vs ?? p.orderNumber;
    const state = p.STATUS ?? p.status;
    if (!orderNo || !state) return null;
    if (!this.mock && p.SIGN) {
      const expected = this.sign(`${orderNo}|${state}`);
      if (expected.toLowerCase() !== p.SIGN.toLowerCase()) return null;
    }
    return {
      eventId: `besteron_${orderNo}_${state}`,
      eventType: 'besteron.result',
      providerPaymentId: orderNo,
      status: mapBesteronState(state),
    };
  }
}

export function createBesteronProvider(
  creds: BesteronCredentials,
  isTestMode: boolean,
): BesteronProvider {
  return new BesteronProvider(creds, isTestMode);
}
