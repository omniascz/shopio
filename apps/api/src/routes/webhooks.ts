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
import { and, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type Stripe from 'stripe';
import { constructWebhookEvent, isStripeEnabled } from '../lib/stripe';
import { sendOrderPaidEmail } from '../lib/order-emails';
import { issueInvoiceForOrder } from '../lib/invoices';
import { clearReservationExpiry, releaseOrderReservations } from '../lib/inventory';
import { mapPacketaStatus, parsePacketaWebhook } from '../lib/packeta';
import { timingSafeEqual } from 'node:crypto';
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

  // Packeta posts XML — keep the raw string for tolerant parsing.
  app.addContentTypeParser(
    ['text/xml', 'application/xml'],
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

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
            config,
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

  // ---------------------------------------------------------------------------
  // POST /webhooks/packeta/{tenantPubId}?secret= — carrier tracking events
  //
  // Per `14 §10` (JOB-PROCESS-SHIPPING-WEBHOOK-EVENT, sync MVP). Packeta has
  // no signature scheme — authentication is the per-tenant secret in the URL
  // (set in admin settings; constant-time compared). Always 200 for processed
  // payloads (carrier retries on non-2xx); auth failures get 401.
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantPubId: string }; Querystring: { secret?: string } }>(
    '/api/2026-05-20/webhooks/packeta/:tenantPubId',
    async (req, reply) => {
      const [tenant] = await db
        .select({ id: schema.tenants.id })
        .from(schema.tenants)
        .where(eq(schema.tenants.pubId, req.params.tenantPubId))
        .limit(1);
      if (!tenant) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unknown endpoint' } });
      }

      const [provider] = await db
        .select({ options: schema.shippingProviderConfigs.options })
        .from(schema.shippingProviderConfigs)
        .where(
          and(
            eq(schema.shippingProviderConfigs.tenantId, tenant.id),
            eq(schema.shippingProviderConfigs.carrierCode, 'zasilkovna'),
          ),
        )
        .limit(1);
      const expected = ((provider?.options ?? {}) as { webhook_secret?: string }).webhook_secret;
      const provided = req.query.secret ?? '';
      if (
        !expected ||
        expected.length !== provided.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
      ) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Bad secret' } });
      }

      const parsedBody = parsePacketaWebhook(req.body);
      if (!parsedBody.barcode && !parsedBody.packetId) {
        app.log.warn({ tenantId: tenant.id }, 'packeta.webhook.unparseable');
        return reply.code(200).send({ received: true, matched: false });
      }

      // Resolve the shipment (tenant + carrier scoped)
      const conditions = [
        eq(schema.shipments.tenantId, tenant.id),
        eq(schema.shipments.carrierCode, 'zasilkovna'),
      ];
      const matcher = parsedBody.barcode
        ? eq(schema.shipments.trackingNumber, parsedBody.barcode)
        : eq(schema.shipments.carrierShipmentId, parsedBody.packetId!);
      const [shipment] = await db
        .select()
        .from(schema.shipments)
        .where(and(...conditions, matcher))
        .limit(1);
      if (!shipment) {
        app.log.warn(
          { tenantId: tenant.id, barcode: parsedBody.barcode, packetId: parsedBody.packetId },
          'packeta.webhook.shipment_not_found',
        );
        return reply.code(200).send({ received: true, matched: false });
      }

      const normalized = mapPacketaStatus(parsedBody.statusCode, parsedBody.statusText);

      await db.transaction(async (tx) => {
        await tx.insert(schema.shipmentEvents).values({
          tenantId: tenant.id,
          shipmentId: shipment.id,
          status: normalized.kind,
          description: normalized.description,
          source: 'webhook',
          isCustomerVisible: normalized.kind !== 'unknown',
          raw: {
            status_code: parsedBody.statusCode,
            status_text: parsedBody.statusText,
          },
        });

        // Delivered closes the shipment — atomic guard, only from handed_over
        // (RULE-SHIP-021: never regress states from webhook data).
        if (normalized.kind === 'delivered') {
          await tx
            .update(schema.shipments)
            .set({
              status: 'delivered',
              statusEnteredAt: new Date(),
              deliveredAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(eq(schema.shipments.id, shipment.id), eq(schema.shipments.status, 'handed_over')),
            );
        }
      });

      if (normalized.kind === 'returned') {
        app.log.warn(
          { shipmentId: shipment.id, number: shipment.number },
          'packeta.webhook.shipment_returning_needs_attention',
        );
      }
      app.log.info(
        { shipmentId: shipment.id, kind: normalized.kind, code: parsedBody.statusCode },
        'packeta.webhook.processed',
      );
      return reply.code(200).send({ received: true, matched: true });
    },
  );
}

// =============================================================================
// Event handlers
// =============================================================================

/**
 * Resolve the order from Stripe event metadata, scoped by tenant.
 *
 * Order pub_ids are unique only per tenant (uq tenant_id+pub_id) — an
 * unscoped lookup could match another tenant's order. Sessions carry
 * `shopio_tenant_id` (tenant pub_id) since the tenant-binding fix; older
 * sessions without it fall back to the global lookup with a loud warning.
 */
async function resolveWebhookOrder(
  app: FastifyInstance,
  db: AppDb,
  session: Stripe.Checkout.Session,
): Promise<typeof schema.orders.$inferSelect | null> {
  const orderPubId = session.client_reference_id ?? session.metadata?.shopio_order_id;
  if (!orderPubId) {
    app.log.warn({ sessionId: session.id }, 'stripe.webhook.no_order_id');
    return null;
  }

  const tenantPubId = session.metadata?.shopio_tenant_id;
  let tenantId: string | null = null;
  if (tenantPubId) {
    const [tenant] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.pubId, tenantPubId))
      .limit(1);
    if (!tenant) {
      app.log.warn({ tenantPubId, sessionId: session.id }, 'stripe.webhook.tenant_not_found');
      return null;
    }
    tenantId = tenant.id;
  } else {
    app.log.warn(
      { sessionId: session.id, orderPubId },
      'stripe.webhook.missing_tenant_metadata_fallback_unscoped',
    );
  }

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(
      tenantId
        ? and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, orderPubId))
        : eq(schema.orders.pubId, orderPubId),
    )
    .limit(1);
  if (!order) {
    app.log.warn({ orderPubId }, 'stripe.webhook.order_not_found');
    return null;
  }
  return order;
}

async function handleCheckoutSessionCompleted(
  app: FastifyInstance,
  db: AppDb,
  config: ShopioConfig,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const resolved = await resolveWebhookOrder(app, db, session);
  if (!resolved) return;

  // Stash the payment intent id — refunds (per `17-returns-refunds.md`) need it.
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Lock + re-check inside one tx: idempotent on already-paid, and never
  // resurrect a cancelled order (sweeper/admin may have cancelled it while
  // this webhook was in flight — its stock hold is already released).
  const order = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, resolved.id))
      .for('update')
      .limit(1);
    if (!locked) return null;

    if (locked.paymentStatus === 'paid') {
      app.log.info({ orderId: locked.id }, 'stripe.webhook.already_paid');
      return null;
    }
    if (locked.status === 'cancelled') {
      app.log.warn(
        { orderId: locked.id, sessionId: session.id },
        'stripe.webhook.paid_after_cancellation_needs_manual_review',
      );
      return null;
    }

    await tx
      .update(schema.orders)
      .set({
        status: 'paid',
        statusEnteredAt: new Date(),
        paymentStatus: 'paid',
        paidAt: new Date(),
        updatedAt: new Date(),
        ...(paymentIntentId && {
          metadata: dsql`${schema.orders.metadata} || ${JSON.stringify({
            stripe_payment_intent_id: paymentIntentId,
          })}::jsonb`,
        }),
      })
      .where(eq(schema.orders.id, locked.id));

    // Paid orders hold their stock reservation indefinitely (per `09`)
    await clearReservationExpiry(tx, locked.id);
    return locked;
  });
  if (!order) return;

  app.log.info(
    {
      orderId: order.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
    },
    'stripe.webhook.order_paid',
  );

  // Issue the tax invoice (per `15 §3.5` — trigger: payment captured). Best-effort:
  // a failure here must not bounce the webhook (Stripe would retry the whole event).
  try {
    const issued = await issueInvoiceForOrder(db, order.tenantId, order.id);
    app.log.info(
      { orderId: order.id, invoiceNumber: issued.invoice.number, created: issued.created },
      'stripe.webhook.invoice_issued',
    );
  } catch (err) {
    app.log.error({ err, orderId: order.id }, 'stripe.webhook.invoice_failed');
  }

  // Send payment confirmation email (best-effort)
  await sendOrderPaidEmail({ db, config, log: app.log }, order.id).catch((err) => {
    app.log.error({ err, orderId: order.id }, 'stripe.webhook.email_failed');
  });
}

async function handleCheckoutSessionExpired(
  app: FastifyInstance,
  db: AppDb,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const resolved = await resolveWebhookOrder(app, db, session);
  if (!resolved) return;

  // Cancel the order + release its stock hold (per `09-inventory.md`).
  // Lock + re-check: a payment webhook may have raced us.
  const cancelled = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: schema.orders.id, status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, resolved.id))
      .for('update')
      .limit(1);
    if (!locked || locked.status !== 'pending_payment') return false;

    await releaseOrderReservations(tx, locked.id, 'order_cancelled');
    await tx
      .update(schema.orders)
      .set({
        status: 'cancelled',
        statusEnteredAt: new Date(),
        cancelledAt: new Date(),
        paymentStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, locked.id));
    return true;
  });

  if (cancelled) app.log.info({ orderId: resolved.id }, 'stripe.webhook.order_cancelled_expired');
}
