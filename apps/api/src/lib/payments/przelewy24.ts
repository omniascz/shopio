/**
 * Przelewy24 (P24) provider (per `13`) — the dominant PL gateway, incl. BLIK.
 *
 * REST register → token → redirect to /trnRequest/{token}. P24 notifies our
 * webhook with the result + a SHA-384 sign (CRC key); we verify the sign and
 * call /transaction/verify to confirm (the verify call is the authoritative
 * check). Per-merchant: merchantId + apiKey + crc. Mock fallback.
 */

import { createHash } from 'node:crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentEvent,
  PaymentProvider,
  ProviderCapabilities,
} from './types';

const CAPABILITIES: ProviderCapabilities = {
  redirectFlow: true,
  offline: false,
  supportsRefund: false,
  supportsPartialRefund: false,
  supportedCurrencies: ['PLN', 'EUR', 'CZK', 'GBP'],
  supportedMethodKinds: ['card', 'blik', 'bank_transfer', 'apple_pay', 'google_pay'],
};

export interface Przelewy24Credentials {
  merchantId?: string;
  posId?: string;
  apiKey?: string;
  crc?: string;
}

function sha384(obj: unknown): string {
  return createHash('sha384').update(JSON.stringify(obj)).digest('hex');
}

export class Przelewy24Provider implements PaymentProvider {
  readonly code = 'przelewy24';
  readonly capabilities = CAPABILITIES;
  private readonly base: string;
  private readonly mock: boolean;

  constructor(
    private readonly creds: Przelewy24Credentials,
    isTestMode: boolean,
  ) {
    this.base = isTestMode ? 'https://sandbox.przelewy24.pl' : 'https://secure.przelewy24.pl';
    this.mock = !(creds.merchantId && creds.apiKey && creds.crc);
  }

  private get posId(): string {
    return this.creds.posId ?? this.creds.merchantId!;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // sessionId = our order number (correlation key for the notification).
    const sessionId = input.orderNumber;
    if (this.mock) {
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}p24_mock=1&id=${encodeURIComponent(sessionId)}`;
      return { providerPaymentId: sessionId, redirectUrl, status: 'processing', raw: { mock: true } };
    }
    const amount = Number(input.amountMinor);
    const sign = sha384({
      sessionId,
      merchantId: Number(this.creds.merchantId),
      amount,
      currency: input.currency,
      crc: this.creds.crc,
    });
    const basic = Buffer.from(`${this.posId}:${this.creds.apiKey}`).toString('base64');
    const res = await fetch(`${this.base}/api/v1/transaction/register`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: Number(this.creds.merchantId),
        posId: Number(this.posId),
        sessionId,
        amount,
        currency: input.currency,
        description: `Objednávka ${input.orderNumber}`,
        email: input.customerEmail,
        country: 'PL',
        language: 'pl',
        urlReturn: input.returnUrl,
        urlStatus: input.notificationUrl,
        sign,
      }),
    });
    const j = (await res.json()) as { data?: { token?: string } };
    if (!j.data?.token) throw new Error('P24 register missing token');
    return {
      providerPaymentId: sessionId,
      redirectUrl: `${this.base}/trnRequest/${j.data.token}`,
      status: 'processing',
      raw: { token: j.data.token },
    };
  }

  /** Verify the P24 notification sign, then confirm via /transaction/verify. */
  async parseWebhookEvent(payload: unknown): Promise<NormalizedPaymentEvent | null> {
    const p = (payload ?? {}) as Record<string, string | number>;
    const sessionId = String(p.sessionId ?? '');
    if (!sessionId) return null;

    if (this.mock) {
      return {
        eventId: `p24_${sessionId}_paid`,
        eventType: 'p24.notification',
        providerPaymentId: sessionId,
        status: 'captured',
      };
    }

    const expected = sha384({
      merchantId: Number(this.creds.merchantId),
      posId: Number(this.posId),
      sessionId,
      amount: Number(p.amount),
      originAmount: Number(p.originAmount),
      currency: p.currency,
      orderId: Number(p.orderId),
      methodId: Number(p.methodId),
      statement: p.statement,
      crc: this.creds.crc,
    });
    if (String(p.sign) !== expected) return null; // bad signature

    // Confirm the transaction (authoritative).
    const verifySign = sha384({
      sessionId,
      orderId: Number(p.orderId),
      amount: Number(p.amount),
      currency: p.currency,
      crc: this.creds.crc,
    });
    const basic = Buffer.from(`${this.posId}:${this.creds.apiKey}`).toString('base64');
    const res = await fetch(`${this.base}/api/v1/transaction/verify`, {
      method: 'PUT',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: Number(this.creds.merchantId),
        posId: Number(this.posId),
        sessionId,
        amount: Number(p.amount),
        currency: p.currency,
        orderId: Number(p.orderId),
        sign: verifySign,
      }),
    });
    const ok = res.ok;
    return {
      eventId: `p24_${sessionId}_${p.orderId}`,
      eventType: 'p24.notification',
      providerPaymentId: sessionId,
      status: ok ? 'captured' : 'failed',
    };
  }
}

export function createPrzelewy24Provider(
  creds: Przelewy24Credentials,
  isTestMode: boolean,
): Przelewy24Provider {
  return new Przelewy24Provider(creds, isTestMode);
}
