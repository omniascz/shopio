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
import { sendSms } from './sms';
import { getInvoiceForOrder } from './invoices';
import { renderInvoicePdf } from './invoice-pdf';
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

  // Attach the tax invoice PDF when already issued (per `15 §3.5`). Best-effort:
  // a render failure must not block the confirmation email.
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const found = await getInvoiceForOrder(db, order.id, 'invoice');
    if (found) {
      const pdf = await renderInvoicePdf(found.invoice, found.items);
      attachments = [
        { filename: `${found.invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' },
      ];
    }
  } catch (err) {
    log.error({ err, orderId: order.id }, 'order_emails.paid.invoice_attachment_failed');
  }

  const { subject, text, html } = renderOrderPaidEmail(ctx);
  await sendEmail(config, {
    to: order.customerEmail,
    subject,
    text,
    html,
    ...(attachments && { attachments }),
  });
  log.info({ orderId: order.id, withInvoice: Boolean(attachments) }, 'order_emails.paid.sent');

  // SMS notification (Shoptet "SMS upozornění") — best-effort; no-op unless an
  // SMS gateway is configured (SMS_GATEWAY_URL + SMS_ENABLED).
  if (order.customerPhone) {
    try {
      const sent = await sendSms(config, {
        to: order.customerPhone,
        text: `${tenant.displayName}: objednavka ${order.orderNumber} byla zaplacena. Dekujeme!`,
      });
      if (sent) log.info({ orderId: order.id }, 'order_sms.paid.sent');
    } catch (err) {
      log.warn({ err, orderId: order.id }, 'order_sms.paid.failed');
    }
  }
}
