/**
 * QR Platba (per `13`) — Czech "pay by QR bank transfer". An offline method:
 * the order is placed pending, the storefront shows a SPAYD QR code that the
 * customer scans in their banking app, and the merchant marks it paid on
 * receipt (like bank_transfer, just with the QR convenience). No gateway, no
 * fees. Popular with small CZ e-shops.
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
  supportedCurrencies: ['CZK', 'EUR'],
  supportedMethodKinds: ['bank_transfer'],
};

export class QrPlatbaProvider implements PaymentProvider {
  readonly code = 'qr_platba';
  readonly capabilities = CAPABILITIES;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerPaymentId: input.paymentPubId,
      redirectUrl: null,
      status: 'pending',
      raw: { method: 'qr_platba', variable_symbol: input.orderNumber },
    };
  }
}

export function createQrPlatbaProvider(): QrPlatbaProvider {
  return new QrPlatbaProvider();
}

/**
 * Build a SPAYD string (Short Payment Descriptor) — the Czech QR-payment
 * standard. `amountMinor` in haléře; VS must be digits only.
 */
export function buildSpayd(input: {
  iban: string;
  amountMinor: bigint;
  currency: string;
  variableSymbol: string;
  message?: string;
}): string {
  const iban = input.iban.replace(/\s+/g, '').toUpperCase();
  const major = `${input.amountMinor / 100n}.${String(input.amountMinor % 100n).padStart(2, '0')}`;
  const vs = input.variableSymbol.replace(/\D/g, '').slice(0, 10);
  const parts = [
    'SPD',
    '1.0',
    `ACC:${iban}`,
    `AM:${major}`,
    `CC:${input.currency.toUpperCase()}`,
  ];
  if (vs) parts.push(`X-VS:${vs}`);
  if (input.message) parts.push(`MSG:${input.message.replace(/\*/g, ' ').slice(0, 60)}`);
  return parts.join('*');
}
