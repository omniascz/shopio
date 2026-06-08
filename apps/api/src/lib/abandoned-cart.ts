/**
 * Abandoned-cart recovery (per `11-cart.md` + `19-marketing-seo.md` MVP).
 *
 * A background sweep e-mails customers who left items in an active cart and
 * went quiet. Conversion lever Shopify ships built-in and we were missing
 * (audit gap). MVP scope: one recovery e-mail per cart, only for carts tied to
 * a logged-in customer (anonymous carts have no e-mail to reach). The
 * "already sent" flag lives in `carts.metadata.recovery_email_sent_at` — no
 * migration, same posture as other lightweight cart flags.
 *
 * Eligibility: status='active', has a customer, idle 1–168 h (don't pester the
 * just-left or chase week-old carts), has items, not yet e-mailed. One coupon
 * is NOT auto-created; if the merchant has the cart's coupon it is echoed.
 */

import { and, eq, gt, lt, isNotNull, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import type { FastifyBaseLogger } from 'fastify';
import { renderAbandonedCartEmail, sendEmail } from './email';

const IDLE_MIN_HOURS = 1;
const IDLE_MAX_HOURS = 168; // 7 days
const BATCH = 50;

export async function sweepAbandonedCarts(
  db: AppDb,
  config: ShopioConfig,
  log: FastifyBaseLogger,
): Promise<number> {
  const now = Date.now();
  const idleBefore = new Date(now - IDLE_MIN_HOURS * 3600_000);
  const idleAfter = new Date(now - IDLE_MAX_HOURS * 3600_000);

  // Eligible carts (superuser read — background job across tenants).
  const carts = await db
    .select({
      id: schema.carts.id,
      tenantId: schema.carts.tenantId,
      customerId: schema.carts.customerId,
      currency: schema.carts.currency,
      couponCode: schema.carts.couponCode,
    })
    .from(schema.carts)
    .where(
      and(
        eq(schema.carts.status, 'active'),
        isNotNull(schema.carts.customerId),
        lt(schema.carts.updatedAt, idleBefore),
        gt(schema.carts.updatedAt, idleAfter),
        dsql`(${schema.carts.metadata} ->> 'recovery_email_sent_at') IS NULL`,
      ),
    )
    .limit(BATCH);

  let sent = 0;
  for (const cart of carts) {
    try {
      const items = await db
        .select({
          title: schema.cartItems.titleSnapshot,
          quantity: schema.cartItems.quantity,
          unitPriceAmount: schema.cartItems.unitPriceAmount,
        })
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, cart.id));
      if (items.length === 0) {
        // Empty cart — mark handled so it isn't rescanned every run.
        await markSent(db, cart.id);
        continue;
      }

      const [customer] = await db
        .select({ email: schema.customers.email, fullName: schema.customers.fullName })
        .from(schema.customers)
        .where(eq(schema.customers.id, cart.customerId!))
        .limit(1);
      if (!customer?.email) {
        await markSent(db, cart.id);
        continue;
      }

      const [tenant] = await db
        .select({ displayName: schema.tenants.displayName, slug: schema.tenants.slug })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, cart.tenantId))
        .limit(1);
      if (!tenant) continue;

      const total = items.reduce((s, it) => s + it.unitPriceAmount * BigInt(it.quantity), 0n);
      const { subject, text, html } = renderAbandonedCartEmail({
        tenantName: tenant.displayName,
        tenantSlug: tenant.slug,
        storefrontBaseUrl: config.SHOPIO_BASE_URL,
        customerName: customer.fullName,
        currency: cart.currency,
        items: items.map((it) => ({
          title: it.title,
          quantity: it.quantity,
          lineTotalMinor: it.unitPriceAmount * BigInt(it.quantity),
        })),
        totalMinor: total,
        couponCode: cart.couponCode,
      });

      await sendEmail(config, { to: customer.email, subject, text, html });
      await markSent(db, cart.id);
      sent++;
    } catch (err) {
      log.error({ err, cartId: cart.id }, 'abandoned_cart.recovery_failed');
    }
  }
  return sent;
}

async function markSent(db: AppDb, cartId: string): Promise<void> {
  await db
    .update(schema.carts)
    .set({
      metadata: dsql`${schema.carts.metadata} || ${JSON.stringify({
        recovery_email_sent_at: new Date().toISOString(),
      })}::jsonb`,
    })
    .where(eq(schema.carts.id, cartId));
}
