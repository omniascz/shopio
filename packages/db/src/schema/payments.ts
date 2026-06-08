/**
 * Payments — provider-abstracted payment records (per `13-payments.md` MVP).
 *
 * Three tables, a pragmatic subset of the canonical `13 §3` model:
 *
 * - `payments` — one row per payment attempt against an order. Carries the
 *   provider-neutral lifecycle (pending → authorized/captured → refunded/…),
 *   amounts, the redirect/authentication URL for hosted gateways, and the
 *   sanitized provider ids needed for refunds + webhook correlation.
 * - `payment_provider_configs` — per-tenant gateway settings (which providers
 *   are enabled, priority, test mode, credentials). Credentials live in
 *   `credentials` JSONB plaintext for the MVP — same posture as the Packeta
 *   keys in shipping configs; Vault migration is a later hardening step.
 * - `payment_webhook_events` — inbound webhook log + idempotency guard, unique
 *   per (tenant, provider, provider_event_id).
 *
 * Deferred (per `13`): refunds table (the `17-returns` flow owns refund rows
 * for now), saved_payment_methods, settlements, disputes, partition pruning.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { orders } from './orders';

/** Provider codes accepted in the MVP (CHECK enforced app-side + schema enum). */
export const PAYMENT_PROVIDER_CODES = [
  'stripe',
  'gopay',
  'comgate',
  'thepay',
  'pays',
  'gpwebpay',
  'payu',
  'barion',
  'besteron',
  'twisto',
  'przelewy24',
  'trustpay',
  'paypal',
  'bank_transfer',
  'qr_platba',
  'cod',
  'gift_card',
  'manual',
] as const;

/** Provider-neutral payment lifecycle (subset of `13 §5.1`). */
export const PAYMENT_STATUSES = [
  'pending',
  'requires_action',
  'processing',
  'authorized',
  'captured',
  'partially_refunded',
  'refunded',
  'failed',
  'cancelled',
  'expired',
] as const;

export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // pay_ NanoID
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'), // denormalized for queries (nullable for guest)

    providerCode: text('provider_code', { enum: PAYMENT_PROVIDER_CODES }).notNull(),
    /** Provider's payment/intent id — Stripe PaymentIntent, GoPay payment id, … */
    providerPaymentId: text('provider_payment_id'),
    /** Provider's charge/transaction id (when distinct from the intent). */
    providerChargeId: text('provider_charge_id'),

    /** Transaction kind — MVP records 'charge' (auto-capture) almost always. */
    kind: text('kind', {
      enum: ['charge', 'authorization', 'capture', 'void', 'refund', 'adjustment'],
    })
      .notNull()
      .default('charge'),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),

    amount: bigint('amount', { mode: 'bigint' }).notNull(), // requested (minor unit)
    amountCaptured: bigint('amount_captured', { mode: 'bigint' }),
    amountRefunded: bigint('amount_refunded', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    currency: text('currency').notNull(),

    /** Instrument details (PCI-safe — never PAN/CVV). Populated from webhooks. */
    methodKind: text('method_kind'), // 'card','bank_transfer','apple_pay','cod',…
    methodBrand: text('method_brand'), // 'visa','mastercard',…
    methodLast4: text('method_last4'),

    /** Hosted-gateway redirect / 3DS challenge URL while status=requires_action. */
    authenticationUrl: text('authentication_url'),

    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),

    /** Idempotency key passed to the provider; unique per tenant. */
    idempotencyKey: text('idempotency_key'),

    /** Last sanitized provider payload (for support/debug). */
    rawPayload: jsonb('raw_payload'),
    webhookReceivedAt: timestamp('webhook_received_at', { withTimezone: true }),

    initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_payments_pub_id').on(t.tenantId, t.pubId),
    providerPaymentUnique: uniqueIndex('uq_payments_provider_payment_id').on(
      t.tenantId,
      t.providerCode,
      t.providerPaymentId,
    ),
    idempotencyUnique: uniqueIndex('uq_payments_idempotency').on(t.tenantId, t.idempotencyKey),
    orderIdx: index('idx_payments_order').on(t.orderId, t.initiatedAt),
    statusIdx: index('idx_payments_status').on(t.tenantId, t.status, t.initiatedAt),
  }),
);

export const paymentProviderConfigs = pgTable(
  'payment_provider_configs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    providerCode: text('provider_code', { enum: PAYMENT_PROVIDER_CODES }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    isTestMode: boolean('is_test_mode').notNull().default(true),
    displayName: text('display_name').notNull(),
    /** Higher first in the checkout list. */
    priority: integer('priority').notNull().default(0),
    supportedCurrencies: text('supported_currencies').array().notNull().default(sql`'{}'`),
    supportedMethodKinds: text('supported_method_kinds').array().notNull().default(sql`'{}'`),
    /** Provider credentials (API keys/ids) — plaintext MVP (Vault later). */
    credentials: jsonb('credentials').notNull().default({}),
    /** Inbound webhook shared secret (constant-time compared / HMAC verified). */
    webhookSecret: text('webhook_secret'),
    options: jsonb('options').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerUnique: uniqueIndex('uq_payment_provider_configs').on(t.tenantId, t.providerCode),
    enabledIdx: index('idx_payment_provider_configs_enabled').on(t.tenantId, t.isEnabled),
  }),
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    providerCode: text('provider_code', { enum: PAYMENT_PROVIDER_CODES }).notNull(),
    providerEventId: text('provider_event_id').notNull(),
    providerEventType: text('provider_event_type').notNull(),
    relatedPaymentId: uuid('related_payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
    payload: jsonb('payload').notNull(),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
  },
  (t) => ({
    eventUnique: uniqueIndex('uq_payment_webhook_events').on(
      t.tenantId,
      t.providerCode,
      t.providerEventId,
    ),
    unprocessedIdx: index('idx_payment_webhook_unprocessed').on(t.receivedAt),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type PaymentProviderConfig = typeof paymentProviderConfigs.$inferSelect;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
