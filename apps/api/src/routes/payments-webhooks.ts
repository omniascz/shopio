/**
 * Inbound payment-provider webhooks (per `13 §11`).
 *
 *   GET|POST /api/{date}/webhooks/payments/{provider}/{tenant_pub_id}
 *
 * Generic over redirect providers (currently GoPay). GoPay notifications are an
 * unauthenticated GET carrying `?id=` — authenticity is established by fetching
 * the authoritative status from the gateway (RULE-PAY-004 adapted: no signature
 * scheme, so the status fetch is the verification). Idempotent ingestion via
 * `payment_webhook_events (tenant, provider, provider_event_id)`.
 *
 * Stripe keeps its dedicated `/webhooks/stripe` route (signature-verified) for
 * now; it is folded into this abstraction in a later commit.
 */

import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { buildProvider, applyPaymentTransition } from '../lib/payments';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const ROUTE = '/api/2026-05-20/webhooks/payments/:provider/:tenantPubId';

type Params = { provider: string; tenantPubId: string };
type Query = { id?: string };

export async function registerPaymentWebhookRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  // Form-encoded webhook bodies (ComGate, Pays, ThePay post application/x-www-
  // form-urlencoded) → parse into an object so the handler can read transId etc.
  if (!app.hasContentTypeParser('application/x-www-form-urlencoded')) {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body, done) => {
        try {
          done(null, Object.fromEntries(new URLSearchParams(body as string)));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
  }

  const handler = async (
    req: import('fastify').FastifyRequest<{ Params: Params; Querystring: Query }>,
    reply: import('fastify').FastifyReply,
  ) => {
    const { provider: providerCode, tenantPubId } = req.params;

    // Resolve tenant (the URL pub_id is the only routing key).
    const [tenant] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.pubId, tenantPubId))
      .limit(1);
    if (!tenant) {
      return reply.code(404).send({ error: { code: 'UNKNOWN_TENANT', message: 'Unknown endpoint' } });
    }

    // Provider config (must exist + be enabled).
    const [cfg] = await db
      .select()
      .from(schema.paymentProviderConfigs)
      .where(
        and(
          eq(schema.paymentProviderConfigs.tenantId, tenant.id),
          eq(schema.paymentProviderConfigs.providerCode, providerCode as 'gopay'),
        ),
      )
      .limit(1);
    if (!cfg || !cfg.isEnabled) {
      return reply.code(404).send({
        error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'Provider not configured' },
      });
    }

    const provider = buildProvider(cfg, config);
    if (!provider || !provider.getStatus) {
      return reply.code(400).send({
        error: { code: 'PROVIDER_UNSUPPORTED', message: 'Provider does not support webhooks' },
      });
    }

    // Extract the provider payment id — GoPay carries it as ?id=, the CZ
    // gateways (ComGate/Pays/ThePay) post it in the form body.
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    const providerPaymentId =
      req.query.id ?? body.transId ?? body.id ?? body.payment_id ?? body.paymentId ?? null;
    if (!providerPaymentId) {
      app.log.warn({ providerCode, tenantId: tenant.id }, 'payments.webhook.no_payment_id');
      return reply.code(200).send({ received: true, matched: false });
    }

    // Fetch the authoritative status from the gateway (this IS the verification).
    let status;
    let methodKind: string | null;
    try {
      const result = await provider.getStatus(providerPaymentId);
      status = result.status;
      methodKind = result.methodKind ?? null;
    } catch (err) {
      app.log.error({ err, providerPaymentId }, 'payments.webhook.status_fetch_failed');
      // 500 → provider retries.
      return reply.code(500).send({ error: { code: 'STATUS_FETCH_FAILED', message: 'Retry' } });
    }

    // Idempotency: one event per (provider, payment, resolved status). Repeated
    // notifications for the same status collapse to a no-op.
    const eventId = `${providerCode}_${providerPaymentId}_${status}`;
    const inserted = await db
      .insert(schema.paymentWebhookEvents)
      .values({
        tenantId: tenant.id,
        providerCode: providerCode as 'gopay',
        providerEventId: eventId,
        providerEventType: `notification.${status}`,
        payload: { id: providerPaymentId, status },
        signatureVerified: false,
        receivedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: schema.paymentWebhookEvents.id });
    if (inserted.length === 0) {
      app.log.info({ providerCode, providerPaymentId, status }, 'payments.webhook.duplicate');
      return reply.code(200).send({ received: true, duplicate: true });
    }

    try {
      const { orderPaid } = await applyPaymentTransition(
        { db, config, log: app.log },
        {
          tenantId: tenant.id,
          providerCode,
          providerPaymentId,
          status,
          methodKind,
        },
      );
      await db
        .update(schema.paymentWebhookEvents)
        .set({ processedAt: new Date() })
        .where(
          and(
            eq(schema.paymentWebhookEvents.tenantId, tenant.id),
            eq(schema.paymentWebhookEvents.providerEventId, eventId),
          ),
        );
      app.log.info(
        { providerCode, providerPaymentId, status, orderPaid },
        'payments.webhook.processed',
      );
    } catch (err) {
      app.log.error({ err, providerPaymentId }, 'payments.webhook.processing_failed');
      return reply.code(500).send({ error: { code: 'PROCESSING_FAILED', message: 'Retry' } });
    }

    return reply.code(200).send({ received: true });
  };

  app.get<{ Params: Params; Querystring: Query }>(ROUTE, handler);
  app.post<{ Params: Params; Querystring: Query }>(ROUTE, handler);
}
