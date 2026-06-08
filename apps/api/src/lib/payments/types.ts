/**
 * Payment provider abstraction (per `13-payments.md §4`, MVP subset).
 *
 * Core (checkout, webhooks, returns) talks to gateways only through the
 * `PaymentProvider` interface — RULE-PAY-001 (no leaky provider specifics in
 * core). Each provider lives in its own module (`cod.ts`, `gopay.ts`,
 * `stripe.ts`) and normalizes its external events to `NormalizedPaymentEvent`
 * before the shared webhook handler applies a state transition.
 *
 * The MVP interface is pragmatic: most CZ/EU gateways (GoPay, ComGate, Stripe
 * Checkout) use a hosted redirect flow, so `createPayment` returns either a
 * redirect URL or an "offline" result (COD / bank transfer with no redirect).
 * Auth/capture separation, saved methods and settlements are deferred.
 */

import { schema } from '@shopio/db';

type PaymentProviderConfig = typeof schema.paymentProviderConfigs.$inferSelect;

/** Provider-neutral payment status (mirrors the `payments.status` enum). */
export type PaymentStatus =
  | 'pending'
  | 'requires_action'
  | 'processing'
  | 'authorized'
  | 'captured'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface ProviderCapabilities {
  /** Hosted redirect flow (customer leaves to the gateway and returns). */
  redirectFlow: boolean;
  /** Offline method — no online authorization (COD, manual bank transfer). */
  offline: boolean;
  supportsRefund: boolean;
  supportsPartialRefund: boolean;
  supportedCurrencies: string[]; // empty = any
  supportedMethodKinds: string[];
}

export interface CreatePaymentInput {
  /** Our payment row pub_id — passed to the gateway as the order reference. */
  paymentPubId: string;
  orderPubId: string;
  orderNumber: string;
  tenantPubId: string;
  customerEmail: string;
  currency: string;
  /** Gross order total in minor units. */
  amountMinor: bigint;
  items: { title: string; quantity: number; unitAmountMinor: bigint }[];
  shippingAmountMinor?: bigint;
  shippingLabel?: string;
  /** Where the gateway should send the customer back to. */
  returnUrl: string;
  cancelUrl: string;
  /** Server-to-server notification (webhook) URL for async status updates. */
  notificationUrl: string;
  /** Idempotency key forwarded to the provider (RULE-PAY-003). */
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  /** Provider's payment/intent id (correlation for webhooks + refunds). */
  providerPaymentId: string | null;
  /** Redirect URL for hosted gateways; null for offline methods. */
  redirectUrl: string | null;
  status: PaymentStatus;
  /** Sanitized provider response for the audit trail. */
  raw?: unknown;
}

export interface ProviderRefundInput {
  providerPaymentId: string;
  amountMinor: bigint;
  currency: string;
  idempotencyKey: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  providerChargeId?: string | null;
  methodKind?: string | null;
  methodBrand?: string | null;
  methodLast4?: string | null;
  raw?: unknown;
}

/** Normalized webhook event — what providers emit to the shared handler. */
export interface NormalizedPaymentEvent {
  /** Stable provider event id for idempotency (uq per tenant+provider). */
  eventId: string;
  eventType: string;
  /** Provider payment id to correlate against `payments.provider_payment_id`. */
  providerPaymentId: string | null;
  /** Mapped lifecycle status this event implies (null = informational only). */
  status: PaymentStatus | null;
  providerChargeId?: string | null;
  methodKind?: string | null;
  methodBrand?: string | null;
  methodLast4?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface PaymentProvider {
  readonly code: string;
  readonly capabilities: ProviderCapabilities;

  /** Start a payment for an order. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Poll the provider for the current status (return-from-gateway reconcile). */
  getStatus?(providerPaymentId: string): Promise<PaymentStatusResult>;

  /** Refund (part of) a captured payment. */
  refund?(input: ProviderRefundInput): Promise<ProviderRefundResult>;

  /** Verify an inbound webhook's authenticity. */
  verifyWebhook?(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    secret: string | null,
  ): boolean;

  /** Parse an inbound webhook payload into a normalized event. */
  parseWebhookEvent?(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedPaymentEvent | null> | NormalizedPaymentEvent | null;
}

/** Factory signature — build a provider from its per-tenant config. */
export type ProviderFactory = (config: PaymentProviderConfig) => PaymentProvider;
