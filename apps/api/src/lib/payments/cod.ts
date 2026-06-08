/**
 * Cash on Delivery (dobírka) — offline payment method (per `13` RULE-PAY-019).
 *
 * No gateway, no redirect: the order proceeds straight to fulfillment with the
 * payment held `pending`. It is captured when the carrier collects cash at
 * delivery (marked paid by the merchant or via the COD settlement flow — the
 * latter is deferred). Essential for the CZ/SK market.
 */

import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  ProviderCapabilities,
} from './types';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: false,
  offline: true,
  supportsRefund: false,
  supportsPartialRefund: false,
  supportedCurrencies: [], // any tenant currency
  supportedMethodKinds: ['cod'],
};

export class CodProvider implements PaymentProvider {
  readonly code = 'cod';
  readonly capabilities = CAPABILITIES;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Offline: nothing to authorize now — the payment row stays pending until
    // cash is collected at delivery.
    return {
      providerPaymentId: input.paymentPubId, // self-reference (no external id)
      redirectUrl: null,
      status: 'pending',
      raw: { method: 'cod', collected_at_delivery: true },
    };
  }
}

export function createCodProvider(): CodProvider {
  return new CodProvider();
}
