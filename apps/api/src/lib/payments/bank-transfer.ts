/**
 * Bank transfer (převod na účet) — offline, zero-cost method (per `13`
 * RULE-PAY-020). The customer pays manually to the merchant's IBAN using the
 * order number as the variable symbol; the merchant marks the order paid on
 * receipt (manual reconciliation). No gateway, no redirect.
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
  supportedCurrencies: [],
  supportedMethodKinds: ['bank_transfer'],
};

export class BankTransferProvider implements PaymentProvider {
  readonly code = 'bank_transfer';
  readonly capabilities = CAPABILITIES;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerPaymentId: input.paymentPubId,
      redirectUrl: null,
      status: 'pending',
      raw: { method: 'bank_transfer', variable_symbol: input.orderNumber },
    };
  }
}

export function createBankTransferProvider(): BankTransferProvider {
  return new BankTransferProvider();
}
