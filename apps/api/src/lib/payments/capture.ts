/**
 * Shared payment capture — marks an order paid from a provider event and runs
 * the post-payment side effects (invoice + email + outbound webhook), exactly
 * like the legacy Stripe webhook handler but provider-neutral.
 *
 * Idempotent + race-safe: locks the order, no-ops if already paid, never
 * resurrects a cancelled order (the sweeper may have released its hold while
 * the webhook was in flight). The `payments` row is moved to `captured`.
 */

import { eq, and, desc } from 'drizzle-orm';
import { sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDb } from '../../db';
import type { ShopioConfig } from '../../config';
import { clearReservationExpiry } from '../inventory';
import { issueInvoiceForOrder } from '../invoices';
import { sendOrderPaidEmail } from '../order-emails';
import { emitWebhookEvent } from '../webhooks-out';
import type { PaymentStatus } from './types';

export interface CaptureContext {
  db: AppDb;
  config: ShopioConfig;
  log: FastifyBaseLogger;
}

export interface PaymentTransitionInput {
  tenantId: string;
  providerCode: string;
  providerPaymentId: string;
  status: PaymentStatus;
  methodKind?: string | null;
  methodBrand?: string | null;
  methodLast4?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

/**
 * Apply a provider status to the matching `payments` row + its order. Returns
 * whether the order transitioned to paid (so callers can log/act). Uses the
 * superuser `db` (RLS-bypassing) — consistent with the existing Stripe webhook.
 */
export async function applyPaymentTransition(
  ctx: CaptureContext,
  input: PaymentTransitionInput,
): Promise<{ orderPaid: boolean }> {
  const { db, config, log } = ctx;

  // Resolve the payment row (tenant + provider scoped).
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.tenantId, input.tenantId),
        eq(schema.payments.providerCode, input.providerCode as 'gopay'),
        eq(schema.payments.providerPaymentId, input.providerPaymentId),
      ),
    )
    .orderBy(desc(schema.payments.initiatedAt))
    .limit(1);
  if (!payment) {
    log.warn(
      { providerPaymentId: input.providerPaymentId, provider: input.providerCode },
      'payments.webhook.payment_not_found',
    );
    return { orderPaid: false };
  }

  const now = new Date();

  // Non-captured terminal/intermediate states: just record on the payment row.
  if (input.status !== 'captured') {
    await db
      .update(schema.payments)
      .set({
        status: input.status,
        ...(input.methodKind && { methodKind: input.methodKind }),
        ...(input.methodBrand && { methodBrand: input.methodBrand }),
        ...(input.methodLast4 && { methodLast4: input.methodLast4 }),
        ...(input.failureCode && { failureCode: input.failureCode }),
        ...(input.failureMessage && { failureMessage: input.failureMessage }),
        ...(input.status === 'failed' && { failedAt: now }),
        ...(input.status === 'expired' && { expiresAt: now }),
        webhookReceivedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.payments.id, payment.id));
    return { orderPaid: false };
  }

  // Captured → mark the order paid inside a lock (idempotent, no-resurrect).
  const order = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, payment.orderId))
      .for('update')
      .limit(1);
    if (!locked) return null;

    if (locked.paymentStatus === 'paid') {
      log.info({ orderId: locked.id }, 'payments.webhook.already_paid');
      return null;
    }
    if (locked.status === 'cancelled') {
      log.warn(
        { orderId: locked.id, providerPaymentId: input.providerPaymentId },
        'payments.webhook.paid_after_cancellation_needs_manual_review',
      );
      return null;
    }

    await tx
      .update(schema.orders)
      .set({
        status: 'paid',
        statusEnteredAt: now,
        paymentStatus: 'paid',
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(schema.orders.id, locked.id));

    await tx
      .update(schema.payments)
      .set({
        status: 'captured',
        amountCaptured: payment.amount,
        capturedAt: now,
        authorizedAt: payment.authorizedAt ?? now,
        ...(input.methodKind && { methodKind: input.methodKind }),
        ...(input.methodBrand && { methodBrand: input.methodBrand }),
        ...(input.methodLast4 && { methodLast4: input.methodLast4 }),
        webhookReceivedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.payments.id, payment.id));

    // Paid orders hold their stock reservation indefinitely (per `09`).
    await clearReservationExpiry(tx, locked.id);
    return locked;
  });

  if (!order) return { orderPaid: false };

  log.info(
    { orderId: order.id, provider: input.providerCode },
    'payments.webhook.order_paid',
  );

  // Issue the tax invoice (per `15 §3.5`). Best-effort — never bounce the webhook.
  try {
    const issued = await issueInvoiceForOrder(db, order.tenantId, order.id);
    log.info(
      { orderId: order.id, invoiceNumber: issued.invoice.number, created: issued.created },
      'payments.webhook.invoice_issued',
    );
  } catch (err) {
    log.error({ err, orderId: order.id }, 'payments.webhook.invoice_failed');
  }

  await sendOrderPaidEmail({ db, config, log }, order.id).catch((err) => {
    log.error({ err, orderId: order.id }, 'payments.webhook.email_failed');
  });

  emitWebhookEvent(db, order.tenantId, 'order.paid', {
    order_number: order.orderNumber,
    status: 'paid',
    payment_status: 'paid',
    total: { amount: order.totalAmount.toString(), currency: order.currency },
    customer_email: order.customerEmail,
    paid_at: now,
  });

  // Keep order.metadata reference to the provider payment (for support/refunds).
  await db
    .update(schema.orders)
    .set({
      metadata: dsql`${schema.orders.metadata} || ${JSON.stringify({
        payment_provider: input.providerCode,
        provider_payment_id: input.providerPaymentId,
      })}::jsonb`,
      updatedAt: now,
    })
    .where(eq(schema.orders.id, order.id));

  return { orderPaid: true };
}
