/**
 * Stripe provider (per `13`) — wires Stripe into the payment abstraction as a
 * per-merchant gateway. The merchant enters their OWN secret key; money settles
 * to their Stripe account (consistent with the other gateways — Shopio never
 * holds funds). Replaces the legacy platform-global env-Stripe path for tenants
 * that configure Stripe here.
 *
 * Verification model: like GoPay/ComGate — the webhook only needs the Checkout
 * Session id; we retrieve the authoritative status from Stripe with the
 * merchant's key (the fetch IS the verification), so no raw-body signature
 * handling is needed in the generic webhook route. Mock fallback without a key.
 */

import Stripe from 'stripe';
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
  supportedCurrencies: [], // Stripe supports 130+ — no restriction
  supportedMethodKinds: ['card', 'apple_pay', 'google_pay'],
};

export interface StripeProviderCredentials {
  secretKey?: string;
}

export class StripeAbstractionProvider implements PaymentProvider {
  readonly code = 'stripe';
  readonly capabilities = CAPABILITIES;
  private readonly client: Stripe | null;
  private readonly mock: boolean;

  constructor(creds: StripeProviderCredentials) {
    this.mock = !creds.secretKey;
    this.client = creds.secretKey
      ? new Stripe(creds.secretKey, { apiVersion: '2026-04-22.dahlia', appInfo: { name: 'Shopio' } })
      : null;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.client) {
      const id = `cs_mock_${input.paymentPubId}`;
      const redirectUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}stripe_mock=1&id=${id}`;
      return { providerPaymentId: id, redirectUrl, status: 'processing', raw: { mock: true } };
    }

    const lineItems = input.items.map((it) => ({
      price_data: {
        currency: input.currency.toLowerCase(),
        unit_amount: Number(it.unitAmountMinor),
        product_data: { name: it.title },
      },
      quantity: it.quantity,
    }));
    if (input.shippingAmountMinor && input.shippingAmountMinor > 0n) {
      lineItems.push({
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: Number(input.shippingAmountMinor),
          product_data: { name: input.shippingLabel ?? 'Doprava' },
        },
        quantity: 1,
      });
    }

    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail,
      line_items: lineItems,
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orderPubId,
      metadata: { shopio_order_number: input.orderNumber, shopio_tenant_id: input.tenantPubId },
      billing_address_collection: 'auto',
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { providerPaymentId: session.id, redirectUrl: session.url, status: 'processing', raw: { id: session.id } };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    if (!this.client || providerPaymentId.startsWith('cs_mock_')) {
      return { status: 'captured', methodKind: 'card', raw: { mock: true } };
    }
    const session = await this.client.checkout.sessions.retrieve(providerPaymentId);
    const status: PaymentStatus = session.payment_status === 'paid' ? 'captured' : 'processing';
    return {
      status,
      providerChargeId:
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      methodKind: 'card',
      raw: { payment_status: session.payment_status },
    };
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    if (!this.client || input.providerPaymentId.startsWith('cs_mock_')) {
      return { providerRefundId: `re_mock_${input.idempotencyKey}`, status: 'succeeded' };
    }
    // Resolve the payment intent from the Checkout Session, then refund it.
    const session = await this.client.checkout.sessions.retrieve(input.providerPaymentId);
    const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!pi) throw new Error('Stripe session has no payment intent to refund');
    const refund = await this.client.refunds.create(
      { payment_intent: pi, amount: Number(input.amountMinor), reason: 'requested_by_customer' },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerRefundId: refund.id, status: refund.status === 'succeeded' ? 'succeeded' : 'processing' };
  }
}

export function createStripeAbstractionProvider(
  creds: StripeProviderCredentials,
): StripeAbstractionProvider {
  return new StripeAbstractionProvider(creds);
}
