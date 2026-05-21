/**
 * Webhooks — inbound from payment providers.
 *
 * Per `13-payments.md §11` (webhook ingestion).
 *
 * MVP scope:
 * - Stripe only
 * - Single endpoint /webhooks/stripe (tenant_pub_id routing comes Fáze 1 wave 2)
 * - Signature verification via STRIPE_WEBHOOK_SECRET (mandatory)
 * - Idempotency: ignore events for orders already in terminal state
 *
 * IMPORTANT: Fastify default JSON parser consumes raw body. We use addContentTypeParser
 * to capture raw bytes for `/webhooks/stripe` so Stripe signature verification works.
 */

import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type Stripe from 'stripe';
import { constructWebhookEvent, isStripeEnabled } from '../lib/stripe';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const WEBHOOK_PATH = '/api/2026-05-20/webhooks/stripe';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerWebhookRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  // Raw body parser scoped to webhook route only.
  // (Fastify content-type parsers are global; we filter inside the handler.)
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = body as Buffer;
    const text = buf.toString('utf8');

    if (req.url === WEBHOOK_PATH) {
      // Keep raw buffer for signature verification
      (req as unknown as { rawBody: Buffer }).rawBody = buf;
      try {
        done(null, text.length > 0 ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
      return;
    }

    // Default JSON parsing for other routes. Empty bodies (DELETE, PATCH without
    // payload) → undefined so Fastify treats `req.body` as absent rather than error.
    if (text.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post(WEBHOOK_PATH, async (req, reply) => {
    if (!isStripeEnabled(config)) {
      return reply.code(503).send({
        error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' },
      });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      return reply.code(400).send({
        error: { code: 'MISSING_SIGNATURE', message: 'stripe-signature header required' },
      });
    }

    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return reply.code(400).send({
        error: {
          code: 'MISSING_RAW_BODY',
          message: 'Raw body required for signature verification',
        },
      });
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(config, rawBody, signature);
    } catch (err) {
      app.log.warn({ err }, 'stripe.webhook.signature_verification_failed');
      return reply.code(400).send({
        error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' },
      });
    }

    app.log.info({ eventId: event.id, eventType: event.type }, 'stripe.webhook.received');

    // Handle event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(
            app,
            db,
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case 'checkout.session.expired':
          await handleCheckoutSessionExpired(app, db, event.data.object as Stripe.Checkout.Session);
          break;
        default:
          app.log.debug({ eventType: event.type }, 'stripe.webhook.ignored');
      }
    } catch (err) {
      app.log.error({ err, eventId: event.id }, 'stripe.webhook.handler_failed');
      // Return 500 → Stripe will retry. Acceptable for transient failures.
      return reply.code(500).send({
        error: { code: 'HANDLER_FAILED', message: 'Internal processing error' },
      });
    }

    return reply.code(200).send({ received: true });
  });
}

// =============================================================================
// Event handlers
// =============================================================================

async function handleCheckoutSessionCompleted(
  app: FastifyInstance,
  db: AppDb,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orderId = session.client_reference_id ?? session.metadata?.shopio_order_id;
  if (!orderId) {
    app.log.warn({ sessionId: session.id }, 'stripe.webhook.no_order_id');
    return;
  }

  const [order] = await db
    .select({
      id: schema.orders.id,
      pubId: schema.orders.pubId,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
    })
    .from(schema.orders)
    .where(eq(schema.orders.pubId, orderId))
    .limit(1);

  if (!order) {
    app.log.warn({ orderId }, 'stripe.webhook.order_not_found');
    return;
  }

  // Idempotency: skip if already paid
  if (order.paymentStatus === 'paid') {
    app.log.info({ orderId: order.id }, 'stripe.webhook.already_paid');
    return;
  }

  await db
    .update(schema.orders)
    .set({
      status: 'paid',
      statusEnteredAt: new Date(),
      paymentStatus: 'paid',
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id));

  app.log.info(
    {
      orderId: order.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
    },
    'stripe.webhook.order_paid',
  );
}

async function handleCheckoutSessionExpired(
  app: FastifyInstance,
  db: AppDb,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orderId = session.client_reference_id ?? session.metadata?.shopio_order_id;
  if (!orderId) return;

  const [order] = await db
    .select({
      id: schema.orders.id,
      status: schema.orders.status,
    })
    .from(schema.orders)
    .where(eq(schema.orders.pubId, orderId))
    .limit(1);

  if (!order || order.status !== 'pending_payment') return;

  // Cancel the order — stock restoration is intentionally deferred to Fáze 1 wave 2
  // (reservation system). For MVP we just mark cancelled; merchant can restock manually.
  await db
    .update(schema.orders)
    .set({
      status: 'cancelled',
      statusEnteredAt: new Date(),
      cancelledAt: new Date(),
      paymentStatus: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id));

  app.log.info({ orderId: order.id }, 'stripe.webhook.order_cancelled_expired');
}
