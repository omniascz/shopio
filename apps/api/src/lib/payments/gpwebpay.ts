/**
 * GP webpay (Global Payments) provider (per `13`) — the bank-backed CZ gateway
 * engine behind KB SmartPay / ČSOB / Česká spořitelna e-shop gateways. One
 * integration → many bank merchants.
 *
 * Signed-redirect model (like Pays, but RSA): we build a request to order.do
 * with an RSA-SHA1 DIGEST over the params (merchant private key); GP webpay
 * redirects back / notifies with PRCODE+SRCODE+DIGEST1 (verified with the GP
 * public key). PRCODE=0 & SRCODE=0 = paid. No status API.
 *
 * Per-merchant: merchantNumber + privateKey (PEM) + gpPublicKey. Mock fallback
 * without credentials. The real RSA signing/verification path must be verified
 * against the GP webpay test gateway before live use.
 */

import { createSign, createVerify } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentEvent,
  PaymentProvider,
  PaymentStatus,
  ProviderCapabilities,
} from './types';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: false,
  supportsPartialRefund: false,
  supportedCurrencies: ['CZK', 'EUR', 'USD', 'GBP'],
  supportedMethodKinds: ['card', 'apple_pay', 'google_pay'],
};

/** GP webpay PRCODE/SRCODE → status. 0/0 = ok. */
export function mapGpwebpayResult(prcode: string, srcode: string): PaymentStatus | null {
  if (prcode === '0' && (srcode === '0' || srcode === '')) return 'captured';
  if (prcode === '50') return 'cancelled'; // user cancelled
  if (prcode) return 'failed';
  return null;
}

export interface GpwebpayCredentials {
  merchantNumber?: string;
  privateKey?: string; // PEM
  privateKeyPassword?: string;
  gpPublicKey?: string; // PEM (for verifying responses)
}

// ISO 4217 numeric currency codes GP webpay expects.
const CURRENCY_NUM: Record<string, string> = { CZK: '203', EUR: '978', USD: '840', GBP: '826' };

export class GpwebpayProvider implements PaymentProvider {
  readonly code = 'gpwebpay';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: GpwebpayCredentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode
      ? 'https://test.3dsecure.gpwebpay.com/pgw/order.do'
      : 'https://3dsecure.gpwebpay.com/pgw/order.do';
    this.mock = !(creds.merchantNumber && creds.privateKey);
  }

  private sign(data: string): string {
    const signer = createSign('RSA-SHA1');
    signer.update(data, 'utf8');
    return signer.sign(
      { key: this.creds.privateKey!, passphrase: this.creds.privateKeyPassword },
      'base64',
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const orderNumber = input.orderNumber.replace(/\D/g, '').slice(-15) || '1';
    if (this.mock) {
      // Correlate on the numeric order number (consistent with the real path).
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}gpwebpay_mock=1&id=${orderNumber}`;
      return { providerPaymentId: orderNumber, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const params: Record<string, string> = {
      MERCHANTNUMBER: this.creds.merchantNumber!,
      OPERATION: 'CREATE_ORDER',
      ORDERNUMBER: orderNumber,
      AMOUNT: String(Number(input.amountMinor)),
      CURRENCY: CURRENCY_NUM[input.currency.toUpperCase()] ?? '203',
      DEPOSITFLAG: '1',
      URL: input.returnUrl,
    };
    const digestInput = Object.values(params).join('|');
    params.DIGEST = this.sign(digestInput);
    const url = `${this.base}?${new URLSearchParams(params).toString()}`;
    return { providerPaymentId: orderNumber, redirectUrl: url, status: 'processing', raw: { signed: true } };
  }

  /** Verify the GP webpay response DIGEST1 and read PRCODE/SRCODE. */
  parseWebhookEvent(payload: unknown): NormalizedPaymentEvent | null {
    const p = (payload ?? {}) as Record<string, string>;
    const orderNo = p.ORDERNUMBER;
    if (!orderNo || p.PRCODE === undefined) return null;

    if (!this.mock && p.DIGEST1 && this.creds.gpPublicKey) {
      const data =
        [p.OPERATION, p.ORDERNUMBER, p.PRCODE, p.SRCODE, p.RESULTTEXT].filter((x) => x !== undefined).join('|') +
        `|${this.creds.merchantNumber}`;
      const verifier = createVerify('RSA-SHA1');
      verifier.update(data, 'utf8');
      if (!verifier.verify(this.creds.gpPublicKey, p.DIGEST1, 'base64')) return null; // bad signature
    }
    return {
      eventId: `gpwebpay_${orderNo}_${p.PRCODE}_${p.SRCODE ?? ''}`,
      eventType: `gpwebpay.result`,
      providerPaymentId: orderNo,
      status: mapGpwebpayResult(p.PRCODE, p.SRCODE ?? ''),
    };
  }
}

export function createGpwebpayProvider(
  creds: GpwebpayCredentials,
  isTestMode: boolean,
): GpwebpayProvider {
  return new GpwebpayProvider(creds, isTestMode);
}
