/**
 * ComGate provider (per `13 §4.2`) — CZ hosted-redirect gateway.
 *
 * REST API with form-encoded requests/responses. Flow: create payment
 * (prepareOnly) → redirect to ComGate → ComGate posts a notification (transId
 * in the form body) → we fetch the authoritative status (the verification).
 * Same per-merchant model as GoPay: the merchant enters their own
 * merchant + secret; money settles to their ComGate account.
 *
 * Mock fallback when credentials are absent — identical posture to GoPay so
 * dev/CI exercise the full flow without a real ComGate account.
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

const BASE = 'https://payments.comgate.cz/v1.0';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: true,
  supportsPartialRefund: true,
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['card', 'bank_transfer', 'apple_pay', 'google_pay'],
};

/** ComGate payment state → our provider-neutral status. */
export function mapComgateState(state: string): PaymentStatus | null {
  switch (state.toUpperCase()) {
    case 'PENDING':
      return 'processing';
    case 'AUTHORIZED':
      return 'authorized';
    case 'PAID':
      return 'captured';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return null;
  }
}

export interface ComgateCredentials {
  merchant?: string;
  secret?: string;
}

/** Parse a ComGate form-encoded response body into a map. */
function parseForm(text: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(text));
}

export class ComgateProvider implements PaymentProvider {
  readonly code = 'comgate';
  readonly capabilities = CAPABILITIES;
  private readonly mock: boolean;

  constructor(
    private readonly creds: ComgateCredentials,
    private readonly isTestMode: boolean,
  ) {
    this.mock = !(creds.merchant && creds.secret);
  }

  private async post(path: string, params: Record<string, string>): Promise<Record<string, string>> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`ComGate ${path} HTTP ${res.status}`);
    const data = parseForm(await res.text());
    if (data.code && data.code !== '0') {
      throw new Error(`ComGate ${path} error ${data.code}: ${data.message ?? ''}`);
    }
    return data;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `cg_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}comgate_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }

    const data = await this.post('/create', {
      merchant: this.creds.merchant!,
      secret: this.creds.secret!,
      price: String(Number(input.amountMinor)), // haléře / cents
      curr: input.currency,
      label: `Objednávka ${input.orderNumber}`,
      refId: input.orderNumber,
      method: 'ALL',
      email: input.customerEmail,
      prepareOnly: 'true',
      country: 'CZ',
      lang: 'cs',
      ...(this.isTestMode ? { test: 'true' } : {}),
    });
    if (!data.transId || !data.redirect) throw new Error('ComGate create missing transId/redirect');
    return {
      providerPaymentId: data.transId,
      redirectUrl: data.redirect,
      status: 'processing',
      raw: data,
    };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('cg_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const data = await this.post('/status', {
      merchant: this.creds.merchant!,
      secret: this.creds.secret!,
      transId: providerPaymentId,
    });
    return {
      status: mapComgateState(data.status ?? '') ?? 'processing',
      methodKind: data.method ?? null,
      raw: data,
    };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('cg_mock_')) {
      return { providerRefundId: `cgr_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    await this.post('/refund', {
      merchant: this.creds.merchant!,
      secret: this.creds.secret!,
      transId: input.providerPaymentId,
      amount: String(Number(input.amountMinor)),
    });
    return { providerRefundId: `cgr_${input.providerPaymentId}`, status: 'succeeded' };
  }

  /** ComGate posts transId in the body; the handler fetches the real status. */
  parseWebhookEvent(payload: unknown): NormalizedPaymentEvent | null {
    const p = (payload ?? {}) as { transId?: string };
    if (!p.transId) return null;
    return {
      eventId: `comgate_${p.transId}_notify`,
      eventType: 'comgate.notification',
      providerPaymentId: p.transId,
      status: null,
    };
  }
}

export function createComgateProvider(
  creds: ComgateCredentials,
  isTestMode: boolean,
): ComgateProvider {
  return new ComgateProvider(creds, isTestMode);
}
