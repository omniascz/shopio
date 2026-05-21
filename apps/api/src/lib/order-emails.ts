/**
 * Order-related email helpers. Builds OrderEmailContext from DB rows
 * and dispatches via `sendEmail()`.
 *
 * Called from:
 * - checkout endpoint (order placed)
 * - Stripe webhook (payment confirmed)
 * - admin status-update endpoint (manual paid mark)
 */

import type { FastifyBaseLogger } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { renderOrderPaidEmail, sendEmail, type OrderEmailContext } from './email';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface EmailServiceDeps {
  db: AppDb;
  config: ShopioConfig;
  log: FastifyBaseLogger;
}

/**
 * Fetch order + tenant + items and send order-paid confirmation email.
 * Idempotent at the email-send level (no DB writes). Safe to call multiple times.
 */
export async function sendOrderPaidEmail(deps: EmailServiceDeps, orderId: string): Promise<void> {
  const { db, config, log } = deps;

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!order) {
    log.warn({ orderId }, 'order_emails.paid.order_not_found');
    return;
  }

  const [tenant] = await db
    .select({ slug: schema.tenants.slug, displayName: schema.tenants.displayName })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, order.tenantId))
    .limit(1);
  if (!tenant) return;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id))
    .orderBy(asc(schema.orderItems.createdAt));

  const ctx: OrderEmailContext = {
    tenantName: tenant.displayName,
    tenantSlug: tenant.slug,
    storefrontBaseUrl: config.SHOPIO_BASE_URL,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress as OrderEmailContext['shippingAddress'],
    items: items.map((it) => ({
      productTitle: it.productTitleSnapshot,
      variantTitle: it.variantTitleSnapshot,
      sku: it.skuSnapshot,
      quantity: it.quantity,
      lineTotalMinor: it.lineTotalAmount,
    })),
    currency: order.currency,
    totalMinor: order.totalAmount,
    placedAt: order.placedAt,
  };

  const { subject, text, html } = renderOrderPaidEmail(ctx);
  await sendEmail(config, { to: order.customerEmail, subject, text, html });
  log.info({ orderId: order.id }, 'order_emails.paid.sent');
}
