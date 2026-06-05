/**
 * Stripe integration wrapper.
 *
 * MVP scope per `13-payments.md` (subset):
 * - Stripe Checkout Session (hosted page) instead of full PaymentIntent flow
 *   → avoids PCI Elements scope; merchant uses Stripe's hosted UI
 * - IDs stashed in `orders.metadata` to skip full payments table
 * - Webhook: only `checkout.session.completed` event handled
 *
 * Future (Fáze 1 wave 2):
 * - Full `payments` table per `13 §3.1`
 * - Provider abstraction (Strategy pattern) for GoPay/ComGate
 * - Refunds, partial captures, disputes
 */

import Stripe from 'stripe';
import type { ShopioConfig } from '../config';

let _client: Stripe | null = null;

export function getStripe(config: ShopioConfig): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) return null;
  if (_client) return _client;
  _client = new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    appInfo: {
      name: 'Shopio',
      version: '0.0.1',
      url: 'https://shopio.com',
    },
  });
  return _client;
}

export function isStripeEnabled(config: ShopioConfig): boolean {
  return Boolean(config.STRIPE_SECRET_KEY);
}

export interface CreateCheckoutSessionInput {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  currency: string;
  items: {
    title: string;
    quantity: number;
    unitAmountMinor: bigint;
  }[];
  /** Gross shipping fee as a separate line item (0/absent = none). */
  shippingAmountMinor?: bigint;
  shippingLabel?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  paymentUrl: string;
}

/**
 * Create a Stripe Checkout Session. Throws if Stripe not configured.
 */
export async function createCheckoutSession(
  config: ShopioConfig,
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const stripe = getStripe(config);
  if (!stripe) throw new Error('Stripe not configured');

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

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.customerEmail,
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.orderId,
    metadata: {
      shopio_order_id: input.orderId,
      shopio_order_number: input.orderNumber,
    },
    payment_intent_data: {
      metadata: {
        shopio_order_id: input.orderId,
        shopio_order_number: input.orderNumber,
      },
    },
    // EU compliance: collect billing address for VAT (Fáze 1 wave 2)
    billing_address_collection: 'auto',
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { sessionId: session.id, paymentUrl: session.url };
}

export interface CreateRefundInput {
  paymentIntentId: string;
  amountMinor: bigint;
  /** Idempotency key — return pub_id keeps retries safe. */
  idempotencyKey: string;
}

/**
 * Refund (part of) a payment intent. Throws if Stripe not configured.
 * Per `13-payments.md` refund subset — full payments table comes later.
 */
export async function createRefund(
  config: ShopioConfig,
  input: CreateRefundInput,
): Promise<{ refundId: string; status: string }> {
  const stripe = getStripe(config);
  if (!stripe) throw new Error('Stripe not configured');
  const refund = await stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: Number(input.amountMinor),
      reason: 'requested_by_customer',
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return { refundId: refund.id, status: refund.status ?? 'pending' };
}

/**
 * Verify Stripe webhook signature + parse event. Throws on invalid signature.
 */
export function constructWebhookEvent(
  config: ShopioConfig,
  rawBody: Buffer | string,
  signatureHeader: string,
): Stripe.Event {
  const stripe = getStripe(config);
  if (!stripe) throw new Error('Stripe not configured');
  if (!config.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret missing');
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, config.STRIPE_WEBHOOK_SECRET);
}
