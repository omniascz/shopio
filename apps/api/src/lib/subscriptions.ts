/**
 * Subscriptions — recurring-order generation + scheduler (per `24` MVP).
 *
 * Self-contained: generates a new pending order each cycle using the shared tax
 * / inventory primitives, WITHOUT touching the checkout or manual-order flows
 * (risk isolation). No auto-charge — the customer pays each generated order via
 * its method (offline ships directly; gateway methods get a pay link e-mail).
 *
 * MVP simplification: recurring orders carry no shipping charge (free) so the
 * scheduler needn't re-resolve a shipping rate each cycle. Documented; a per-
 * subscription shipping snapshot is a follow-up.
 */

import { and, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import { computeTax, serializeBreakdown } from './tax';
import { resolveRates } from './tax-resolver';
import { availableQuantity, reserveStock, UNPAID_RESERVATION_TTL_HOURS } from './inventory';
import { renderOrderPlacedEmail, sendEmail } from './email';
import { emitWebhookEvent } from './webhooks-out';

type Subscription = typeof schema.subscriptions.$inferSelect;
type SubItem = { variant_id: string; quantity: number };

export class SubscriptionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Next occurrence strictly after `now`, stepping by the cadence (no drift). */
export function advanceRunAt(from: Date, unit: 'week' | 'month', count: number, now: Date): Date {
  let next = new Date(from);
  let guard = 0;
  do {
    if (unit === 'week') next = new Date(next.getTime() + count * 7 * 86400_000);
    else next = addMonths(next, count);
  } while (next <= now && guard++ < 240);
  return next;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCMonth(r.getUTCMonth() + n, 1); // avoid month-end overflow
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

async function nextOrderNumber(
  tx: { select: AppDb['select']; execute: AppDb['execute'] },
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  await tx.execute(dsql`SELECT pg_advisory_xact_lock(hashtext(${`ord:${tenantId}:${year}`}))`);
  const result = await tx
    .select({ count: dsql<number>`COUNT(*)::int` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, tenantId),
        dsql`EXTRACT(YEAR FROM ${schema.orders.placedAt}) = ${year}`,
      ),
    );
  const seq = (result[0]?.count ?? 0) + 1;
  return `ORD-${year}-${String(seq).padStart(8, '0')}`;
}

/** Create one order for a subscription. Returns the order number. */
export async function generateSubscriptionOrder(
  db: AppDb,
  rlsDb: AppDb,
  config: ShopioConfig,
  sub: Subscription,
  log: FastifyBaseLogger,
): Promise<string> {
  const [tenant] = await db
    .select({
      id: schema.tenants.id,
      slug: schema.tenants.slug,
      displayName: schema.tenants.displayName,
      defaultCurrency: schema.tenants.defaultCurrency,
      countryCode: schema.tenants.countryCode,
      priceIncludesTax: schema.tenants.priceIncludesTax,
      shippingTaxClass: schema.tenants.shippingTaxClass,
      defaultLocale: schema.tenants.defaultLocale,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, sub.tenantId))
    .limit(1);
  if (!tenant) throw new SubscriptionError('TENANT_NOT_FOUND', 'Tenant not found');

  const [customer] = await db
    .select({ email: schema.customers.email, fullName: schema.customers.fullName })
    .from(schema.customers)
    .where(eq(schema.customers.id, sub.customerId))
    .limit(1);
  if (!customer) throw new SubscriptionError('CUSTOMER_NOT_FOUND', 'Customer not found');

  const subItems = (sub.items as SubItem[]).filter((i) => i.quantity > 0);
  if (subItems.length === 0) throw new SubscriptionError('NO_ITEMS', 'Subscription has no items');

  const variantIds = subItems.map((i) => i.variant_id);
  const variants = await withTenant(rlsDb, tenant.id, (tx) =>
    tx
      .select({
        id: schema.productVariants.id,
        productId: schema.productVariants.productId,
        sku: schema.productVariants.sku,
        title: schema.productVariants.title,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
        taxClassCode: schema.products.taxClassCode,
        productTitle: schema.products.title,
      })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
      .where(
        and(
          eq(schema.productVariants.tenantId, tenant.id),
          inArray(schema.productVariants.id, variantIds),
        ),
      ),
  );
  const vById = new Map(variants.map((v) => [v.id, v]));
  const lines = subItems.map((i) => ({ item: i, v: vById.get(i.variant_id) }));
  if (lines.some((l) => !l.v)) {
    throw new SubscriptionError('VARIANT_NOT_FOUND', 'A subscribed variant no longer exists');
  }

  const currency = tenant.defaultCurrency.toUpperCase();
  const rates = await resolveRates(db, tenant.id, tenant.countryCode, tenant.countryCode);
  const tax = computeTax({
    lines: lines.map((l) => ({
      ref: l.v!.id,
      amount: l.v!.priceAmount * BigInt(l.item.quantity),
      taxClassCode: l.v!.taxClassCode,
    })),
    shippingAmount: 0n,
    shippingTaxClass: tenant.shippingTaxClass,
    rates,
    priceIncludesTax: tenant.priceIncludesTax,
  });
  const taxByRef = new Map(tax.lines.map((l) => [l.ref, l]));
  const grossGoods = lines.reduce((s, l) => s + l.v!.priceAmount * BigInt(l.item.quantity), 0n);
  const total = grossGoods;

  const orderNumber = await withTenant(rlsDb, tenant.id, async (tx) => {
    const fresh = await tx
      .select({
        id: schema.productVariants.id,
        title: schema.productVariants.title,
        stockOnHand: schema.productVariants.stockOnHand,
        stockReserved: schema.productVariants.stockReserved,
        allowBackorder: schema.productVariants.allowBackorder,
      })
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.id, variantIds))
      .for('update');
    const freshMap = new Map(fresh.map((f) => [f.id, f]));
    for (const l of lines) {
      const f = freshMap.get(l.v!.id)!;
      if (availableQuantity(f) < l.item.quantity && !f.allowBackorder) {
        throw new SubscriptionError(
          'INSUFFICIENT_STOCK',
          `Nedostatek skladem: ${f.title}`,
        );
      }
    }

    const number = await nextOrderNumber(tx, tenant.id);
    const [order] = await tx
      .insert(schema.orders)
      .values({
        tenantId: tenant.id,
        pubId: generatePubId('ord'),
        orderNumber: number,
        customerId: sub.customerId,
        customerEmail: customer.email,
        customerName: customer.fullName ?? customer.email,
        shippingAddress: sub.shippingAddress,
        billingAddress: sub.shippingAddress,
        currency,
        subtotalAmount: grossGoods,
        shippingAmount: 0n,
        taxAmount: tax.totals.taxAmount,
        priceIncludesTax: tenant.priceIncludesTax,
        taxBreakdown: serializeBreakdown(tax.breakdown),
        totalAmount: total,
        status: 'pending_payment',
        paymentStatus: 'pending',
        paymentMethod: sub.paymentMethod,
        channelKind: 'manual',
        customerLocale: tenant.defaultLocale,
        customerNote: `Předplatné ${sub.pubId}`,
      })
      .returning();
    if (!order) throw new SubscriptionError('ORDER_INSERT_FAILED', 'Could not create order');

    await tx.insert(schema.orderItems).values(
      lines.map((l) => {
        const lineGross = l.v!.priceAmount * BigInt(l.item.quantity);
        const lt = taxByRef.get(l.v!.id);
        return {
          tenantId: tenant.id,
          orderId: order.id,
          pubId: generatePubId('oit'),
          variantId: l.v!.id,
          productId: l.v!.productId,
          productTitleSnapshot: l.v!.productTitle,
          variantTitleSnapshot: l.v!.title,
          skuSnapshot: l.v!.sku,
          quantity: l.item.quantity,
          unitPriceAmount: l.v!.priceAmount,
          unitPriceCurrency: l.v!.priceCurrency,
          lineSubtotalAmount: lt?.baseAmount ?? lineGross,
          lineDiscountAmount: 0n,
          taxClassCode: lt?.taxClassCode ?? l.v!.taxClassCode,
          taxRateBasisPoints: lt?.taxRateBasisPoints ?? 0,
          lineTaxAmount: lt?.taxAmount ?? 0n,
          lineTotalAmount: lineGross,
        };
      }),
    );

    await reserveStock(tx, {
      tenantId: tenant.id,
      orderId: order.id,
      lines: lines.map((l) => ({ variantId: l.v!.id, quantity: l.item.quantity })),
      expiresAt: new Date(Date.now() + UNPAID_RESERVATION_TTL_HOURS * 3600_000),
    });

    return order.orderNumber;
  });

  // Outbound webhook + order-placed e-mail (best-effort).
  emitWebhookEvent(db, tenant.id, 'order.placed', {
    order_number: orderNumber,
    status: 'pending_payment',
    payment_status: 'pending',
    total: { amount: total.toString(), currency },
    customer_email: customer.email,
    placed_at: new Date(),
  });
  try {
    const { subject, text, html } = renderOrderPlacedEmail({
      tenantName: tenant.displayName,
      tenantSlug: tenant.slug,
      storefrontBaseUrl: config.SHOPIO_BASE_URL,
      orderNumber,
      customerName: customer.fullName,
      customerEmail: customer.email,
      shippingAddress: sub.shippingAddress as never,
      items: lines.map((l) => ({
        productTitle: l.v!.productTitle,
        variantTitle: l.v!.title,
        sku: l.v!.sku,
        quantity: l.item.quantity,
        lineTotalMinor: l.v!.priceAmount * BigInt(l.item.quantity),
      })),
      currency,
      totalMinor: total,
      placedAt: new Date(),
    });
    await sendEmail(config, { to: customer.email, subject, text, html });
  } catch (err) {
    log.error({ err, subId: sub.id }, 'subscription.email_failed');
  }

  return orderNumber;
}

/**
 * Scheduler — claim each due subscription (advance its next run atomically so
 * only one runner processes it), then generate the order. A generation failure
 * skips that cycle (the cadence already advanced) — logged, not retried.
 */
export async function runDueSubscriptions(
  db: AppDb,
  rlsDb: AppDb,
  config: ShopioConfig,
  log: FastifyBaseLogger,
): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.status, 'active'), dsql`${schema.subscriptions.nextRunAt} <= now()`))
    .limit(50);

  let created = 0;
  for (const sub of due) {
    // Claim: advance the cadence atomically; the conditional guard makes it
    // single-flight across concurrent runners.
    const nextRun = advanceRunAt(sub.nextRunAt, sub.intervalUnit, sub.intervalCount, now);
    const claimed = await withTenant(rlsDb, sub.tenantId, (tx) =>
      tx
        .update(schema.subscriptions)
        .set({
          nextRunAt: nextRun,
          lastRunAt: now,
          ordersCreated: dsql`${schema.subscriptions.ordersCreated} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.subscriptions.id, sub.id),
            eq(schema.subscriptions.status, 'active'),
            dsql`${schema.subscriptions.nextRunAt} <= now()`,
          ),
        )
        .returning({ id: schema.subscriptions.id }),
    );
    if (claimed.length === 0) continue; // another runner took it

    try {
      await generateSubscriptionOrder(db, rlsDb, config, sub, log);
      created++;
    } catch (err) {
      log.error({ err, subId: sub.id }, 'subscription.generate_failed');
    }
  }
  return created;
}
