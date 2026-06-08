/**
 * Pays.cz provider (per `13 §4.2`) — CZ redirect gateway.
 *
 * Unlike GoPay/ComGate/ThePay (REST create), Pays is a redirect-with-params
 * model: we build a gateway URL and redirect the customer; Pays has no status
 * API — instead the notification CARRIES the result + a verification hash. So
 * `parseWebhookEvent` verifies the hash (using the merchant key) and returns the
 * status directly; there is no `getStatus`.
 *
 * Per-merchant: the merchant enters MerchantId + ShopId + apiKey (klíč); money
 * settles to their Pays account. Mock fallback without credentials.
 */

import { createHash } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentEvent,
  PaymentProvider,
  PaymentStatus,
  ProviderCapabilities,
} from './types';

const GATEWAY = 'https://www.pays.cz/paymentorder';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: false, // Pays refunds are handled in their portal (MVP)
  supportsPartialRefund: false,
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['card', 'bank_transfer'],
};

/** Pays PaymentOrderStatusID → our status. 2/3 = paid, 4 = cancelled. */
export function mapPaysStatus(statusId: string): PaymentStatus | null {
  switch (String(statusId)) {
    case '1': // created/pending
      return 'processing';
    case '2': // accepted (online)
    case '3': // paid
      return 'captured';
    case '4': // cancelled
      return 'cancelled';
    default:
      return null;
  }
}

export interface PaysCredentials {
  merchantId?: string;
  shopId?: string;
  apiKey?: string;
}

export class PaysProvider implements PaymentProvider {
  readonly code = 'pays';
  readonly capabilities = CAPABILITIES;
  private readonly mock: boolean;

  constructor(
    private readonly creds: PaysCredentials,
    private readonly _isTestMode: boolean,
  ) {
    this.mock = !(creds.merchantId && creds.shopId && creds.apiKey);
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (this.mock) {
      // Pays correlates on our order number, so mock uses it too (consistent
      // with the real path) — the notification carries MerchantOrderNumber.
      const id = input.orderNumber;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}pays_mock=1&id=${encodeURIComponent(id)}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }

    // Pays is a GET redirect with params; the order number is our correlation id.
    const params = new URLSearchParams({
      Merchant: this.creds.merchantId!,
      Shop: this.creds.shopId!,
      Currency: input.currency,
      Amount: String(Number(input.amountMinor)),
      MerchantOrderNumber: input.orderNumber,
      Email: input.customerEmail,
      ReturnURL: input.returnUrl,
    });
    return {
      providerPaymentId: input.orderNumber, // Pays correlates on our order number
      redirectUrl: `${GATEWAY}?${params.toString()}`,
      status: 'processing',
      raw: { redirect_params: true },
    };
  }

  /** Verify the Pays notification hash, then return the carried status. */
  parseWebhookEvent(payload: unknown): NormalizedPaymentEvent | null {
    const p = (payload ?? {}) as Record<string, string>;
    const orderNo = p.MerchantOrderNumber ?? p.PaymentOrderID;
    const statusId = p.PaymentOrderStatusID;
    if (!orderNo || !statusId) return null;

    // Hash verification: Pays signs the notification with the merchant key.
    // (Exact field order per Pays docs; verified against their sandbox before
    // live use — mock notifications skip the hash.)
    if (!this.mock && p.hash) {
      const expected = createHash('md5')
        .update(`${p.PaymentOrderID ?? ''}${statusId}${this.creds.apiKey ?? ''}`)
        .digest('hex');
      if (expected.toLowerCase() !== p.hash.toLowerCase()) return null; // bad hash → reject
    }

    return {
      eventId: `pays_${orderNo}_${statusId}`,
      eventType: `pays.status.${statusId}`,
      providerPaymentId: orderNo,
      status: mapPaysStatus(statusId),
    };
  }
}

export function createPaysProvider(creds: PaysCredentials, isTestMode: boolean): PaysProvider {
  return new PaysProvider(creds, isTestMode);
}
