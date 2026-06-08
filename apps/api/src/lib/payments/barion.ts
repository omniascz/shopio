/**
 * Barion provider (per `13`) — CZ/SK/EU gateway (JSON REST).
 *
 * POST /v2/Payment/Start (POSKey + payment) → PaymentId + GatewayUrl; status via
 * GET /v2/Payment/GetPaymentState. Per-merchant: posKey. Mock fallback; real
 * flow needs Barion-sandbox verification.
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
  supportedCurrencies: ['CZK', 'EUR', 'HUF', 'USD'],
  supportedMethodKinds: ['card', 'apple_pay', 'google_pay'],
};

export function mapBarionState(state: string): PaymentStatus | null {
  switch (state.toLowerCase()) {
    case 'prepared':
    case 'started':
    case 'inprogress':
    case 'reserved':
      return 'processing';
    case 'succeeded':
      return 'captured';
    case 'partiallysucceeded':
      return 'partially_refunded';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

export interface BarionCredentials {
  posKey?: string;
}

export class BarionProvider implements PaymentProvider {
  readonly code = 'barion';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: BarionCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://api.test.barion.com' : 'https://api.barion.com';
    this.mock = !creds.posKey;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      const id = `barion_mock_${createHash('sha256').update(input.paymentPubId).digest('hex').slice(0, 16)}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}barion_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const res = await fetch(`${this.base}/v2/Payment/Start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        POSKey: this.creds.posKey,
        PaymentType: 'Immediate',
        Currency: input.currency,
        PaymentRequestId: input.orderNumber,
        RedirectUrl: input.returnUrl,
        CallbackUrl: input.notificationUrl,
        Transactions: [
          {
            POSTransactionId: input.orderNumber,
            Payee: input.customerEmail,
            Total: Number(input.amountMinor) / 100,
            Items: input.items.map((it) => ({
              Name: it.title,
              Quantity: it.quantity,
              Unit: 'ks',
              UnitPrice: Number(it.unitAmountMinor) / 100,
              ItemTotal: (Number(it.unitAmountMinor) * it.quantity) / 100,
            })),
          },
        ],
      }),
    });
    const j = (await res.json()) as { PaymentId?: string; GatewayUrl?: string };
    if (!j.PaymentId || !j.GatewayUrl) throw new Error('Barion start missing PaymentId/GatewayUrl');
    return { providerPaymentId: j.PaymentId, redirectUrl: j.GatewayUrl, status: 'processing', raw: j };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (this.mock || providerPaymentId.startsWith('barion_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const res = await fetch(
      `${this.base}/v2/Payment/GetPaymentState?POSKey=${this.creds.posKey}&PaymentId=${providerPaymentId}`,
    );
    if (!res.ok) throw new Error(`Barion status ${res.status}`);
    const j = (await res.json()) as { Status?: string };
    return { status: mapBarionState(j.Status ?? '') ?? 'processing', raw: j };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (this.mock || input.providerPaymentId.startsWith('barion_mock_')) {
      return { providerRefundId: `barionr_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    await fetch(`${this.base}/v2/Payment/Refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        POSKey: this.creds.posKey,
        PaymentId: input.providerPaymentId,
        TransactionsToRefund: [{ AmountToRefund: Number(input.amountMinor) / 100 }],
      }),
    });
    return { providerRefundId: `barionr_${input.providerPaymentId}`, status: 'succeeded' };
  }
}

export function createBarionProvider(creds: BarionCredentials, isTestMode: boolean): BarionProvider {
  return new BarionProvider(creds, isTestMode);
}
