/**
 * Outbound webhooks (per `28-developer-platform.md` MVP) — lean dispatcher.
 *
 * On a domain event, fan out to the tenant's enabled endpoints whose topics
 * match: insert a durable delivery row, then POST the signed payload inline
 * (off the request path). No job queue — retries use the "retry-on-next-event"
 * sweep (any later event re-attempts due deliveries) plus a per-call sweep.
 *
 * The signing secret is a SHARED secret (needed to compute the HMAC), stored in
 * `secret_hash` — not a one-way hash. Shown once to the tenant for verification.
 *
 * Deferred (per `28`): async worker/DLQ, per-subscription retry config, filtering,
 * replay UI, signing-key rotation.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { and, arrayContains, eq, inArray, lte, or, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const PAUSE_THRESHOLD = 20; // consecutive failures → auto-pause (RULE-DEV-009)
/** Backoff per attempt count (ms): ~30s, 2m, 10m, 1h. */
const BACKOFF_MS = [30_000, 120_000, 600_000, 3_600_000];

export const WEBHOOK_TOPICS = [
  'order.placed',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
  'product.created',
] as const;
export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

export function generateWebhookSecret(): { secret: string; hint: string } {
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  return { secret, hint: secret.slice(-4) };
}

function sign(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Emit a domain event to matching endpoints (fire-and-forget). Never throws to
 * the caller — webhook failures must not break the originating operation.
 */
export function emitWebhookEvent(
  db: AppDb,
  tenantId: string,
  eventType: WebhookTopic,
  payload: Record<string, unknown>,
): void {
  void (async () => {
    try {
      // Retry-on-next-event: sweep this tenant's due deliveries first.
      await sweepDueDeliveries(db, tenantId);

      const endpoints = await db
        .select()
        .from(schema.webhookEndpoints)
        .where(
          and(
            eq(schema.webhookEndpoints.tenantId, tenantId),
            eq(schema.webhookEndpoints.enabled, true),
            eq(schema.webhookEndpoints.paused, false),
            arrayContains(schema.webhookEndpoints.topics, [eventType]),
          ),
        );
      if (endpoints.length === 0) return;

      const eventId = generatePubId('evt');
      for (const ep of endpoints) {
        const [delivery] = await db
          .insert(schema.webhookDeliveries)
          .values({
            tenantId,
            pubId: generatePubId('whd'),
            endpointId: ep.id,
            eventType,
            eventId,
            payload,
            status: 'pending',
          })
          .returning();
        if (delivery) await attemptDelivery(db, ep, delivery);
      }
    } catch {
      /* swallow — dispatcher is best-effort */
    }
  })();
}

/** Re-attempt due (pending/failed, next_attempt_at ≤ now) deliveries for a tenant. */
export async function sweepDueDeliveries(db: AppDb, tenantId: string, limit = 20): Promise<void> {
  const due = await db
    .select()
    .from(schema.webhookDeliveries)
    .where(
      and(
        eq(schema.webhookDeliveries.tenantId, tenantId),
        inArray(schema.webhookDeliveries.status, ['pending', 'failed']),
        or(
          dsql`${schema.webhookDeliveries.nextAttemptAt} IS NULL`,
          lte(schema.webhookDeliveries.nextAttemptAt, new Date()),
        ),
      ),
    )
    .limit(limit);
  for (const d of due) {
    const [ep] = await db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.id, d.endpointId))
      .limit(1);
    if (ep) await attemptDelivery(db, ep, d);
  }
}

async function attemptDelivery(
  db: AppDb,
  endpoint: typeof schema.webhookEndpoints.$inferSelect,
  delivery: typeof schema.webhookDeliveries.$inferSelect,
): Promise<void> {
  const body = JSON.stringify({
    id: delivery.eventId,
    type: delivery.eventType,
    created_at: delivery.createdAt,
    data: delivery.payload,
  });
  const ts = Math.floor(Date.now() / 1000);
  const attempts = delivery.attempts + 1;

  let ok = false;
  let responseCode: number | null = null;
  let lastError: string | null = null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-shopio-event': delivery.eventType,
        'x-shopio-delivery': delivery.pubId,
        'x-shopio-signature': `t=${ts},sha256=${sign(endpoint.secretHash, ts, body)}`,
      },
      body,
      signal: ac.signal,
    }).finally(() => clearTimeout(timer));
    responseCode = res.status;
    ok = res.ok;
    if (!ok) lastError = `HTTP ${res.status}`;
  } catch (err) {
    lastError = (err as Error).message.slice(0, 300);
  }

  if (ok) {
    await db
      .update(schema.webhookDeliveries)
      .set({ status: 'delivered', attempts, responseCode, deliveredAt: new Date(), nextAttemptAt: null })
      .where(eq(schema.webhookDeliveries.id, delivery.id));
    if (endpoint.consecutiveFailures > 0) {
      await db
        .update(schema.webhookEndpoints)
        .set({ consecutiveFailures: 0, updatedAt: new Date() })
        .where(eq(schema.webhookEndpoints.id, endpoint.id));
    }
    return;
  }

  const exhausted = attempts >= MAX_ATTEMPTS;
  const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;
  await db
    .update(schema.webhookDeliveries)
    .set({
      status: exhausted ? 'abandoned' : 'failed',
      attempts,
      responseCode,
      lastError,
      nextAttemptAt: exhausted ? null : new Date(Date.now() + backoff),
    })
    .where(eq(schema.webhookDeliveries.id, delivery.id));

  const failures = endpoint.consecutiveFailures + 1;
  await db
    .update(schema.webhookEndpoints)
    .set({ consecutiveFailures: failures, paused: failures >= PAUSE_THRESHOLD, updatedAt: new Date() })
    .where(eq(schema.webhookEndpoints.id, endpoint.id));
}
