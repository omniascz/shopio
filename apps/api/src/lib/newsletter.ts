/**
 * Newsletter + email-campaign logic (P3, per `19`). Subscribe/unsubscribe and
 * an inline campaign sender (best-effort; a queue comes later).
 */

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { FastifyBaseLogger } from 'fastify';
import { sendEmail } from './email';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

/** Subscribe an email (idempotent; reactivates an unsubscribed one). */
export async function subscribe(
  tx: TenantTx,
  tenantId: string,
  email: string,
  source: string,
  customerId?: string | null,
): Promise<void> {
  const lower = email.trim().toLowerCase();
  const token = randomBytes(24).toString('base64url');
  await tx
    .insert(schema.newsletterSubscribers)
    .values({ tenantId, email: lower, unsubscribeToken: token, source, customerId: customerId ?? null })
    .onConflictDoUpdate({
      target: [schema.newsletterSubscribers.tenantId, schema.newsletterSubscribers.email],
      set: { status: 'active', unsubscribedAt: null },
    });
}

/** Unsubscribe by token (the one-click link). Returns the matched email or null. */
export async function unsubscribeByToken(db: AppDb, token: string): Promise<string | null> {
  const [row] = await db
    .update(schema.newsletterSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
    .where(eq(schema.newsletterSubscribers.unsubscribeToken, token))
    .returning({ email: schema.newsletterSubscribers.email });
  return row?.email ?? null;
}

interface SendDeps {
  db: AppDb;
  config: ShopioConfig;
  log?: FastifyBaseLogger;
}

/** A hard cap on inline-sent recipients (a queue handles larger lists later). */
const MAX_INLINE_RECIPIENTS = 2000;

/**
 * Send a draft campaign to the tenant's active subscribers. Inline + best-effort:
 * each email carries the recipient's unsubscribe link. Marks the campaign sent
 * and records the count. Returns { sent, recipients }.
 */
export async function sendCampaign(
  deps: SendDeps,
  tenantId: string,
  tenantSlug: string,
  campaignId: string,
  storefrontBase: string,
): Promise<{ sent: number; recipients: number }> {
  const subs = await deps.db
    .select({
      email: schema.newsletterSubscribers.email,
      token: schema.newsletterSubscribers.unsubscribeToken,
    })
    .from(schema.newsletterSubscribers)
    .where(
      and(
        eq(schema.newsletterSubscribers.tenantId, tenantId),
        eq(schema.newsletterSubscribers.status, 'active'),
      ),
    )
    .limit(MAX_INLINE_RECIPIENTS);

  const [campaign] = await deps.db
    .select()
    .from(schema.emailCampaigns)
    .where(and(eq(schema.emailCampaigns.tenantId, tenantId), eq(schema.emailCampaigns.id, campaignId)))
    .limit(1);
  if (!campaign) return { sent: 0, recipients: 0 };

  await deps.db
    .update(schema.emailCampaigns)
    .set({ status: 'sending', recipientCount: subs.length })
    .where(eq(schema.emailCampaigns.id, campaignId));

  let sent = 0;
  for (const sub of subs) {
    const unsubUrl = `${storefrontBase.replace(/\/$/, '')}/api/2026-05-20/storefront/${tenantSlug}/newsletter/unsubscribe?token=${sub.token}`;
    const footer = `<hr><p style="font-size:12px;color:#888">Nechcete dostávat tyto e-maily? <a href="${unsubUrl}">Odhlásit se</a></p>`;
    try {
      await sendEmail(deps.config, {
        to: sub.email,
        subject: campaign.subject,
        html: `${campaign.bodyHtml}${footer}`,
        text: campaign.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + `\n\nOdhlásit: ${unsubUrl}`,
      });
      sent++;
    } catch (err) {
      deps.log?.error({ err, campaignId }, 'newsletter.send_failed');
    }
  }

  await deps.db
    .update(schema.emailCampaigns)
    .set({ status: 'sent', sentCount: sent, sentAt: new Date() })
    .where(eq(schema.emailCampaigns.id, campaignId));

  return { sent, recipients: subs.length };
}
