/**
 * GDPR data subject rights (per `30-security.md` §GDPR) — self-service export
 * (Right to Access / Portability, Art. 15/20) + erasure (Right to be Forgotten,
 * Art. 17).
 *
 * Erasure anonymizes the customer's personal data (contact, address, auth)
 * across the tables that hold it — BUT keeps the immutable tax invoices
 * (`invoices.buyer_snapshot`) and the order financial records, which CZ law
 * requires retaining for 10 years (Art. 17(3)(b) — legal obligation overrides
 * erasure). Order contact PII is redacted; the amounts/numbers stay for
 * accounting.
 */

import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import type { AppDb } from '../db';

type Customer = typeof schema.customers.$inferSelect;

export interface CustomerDataExport {
  exported_at: string;
  profile: {
    email: string;
    full_name: string | null;
    phone: string | null;
    created_at: string;
    email_verified: boolean;
    default_address: unknown;
  };
  orders: {
    number: string;
    status: string;
    payment_status: string;
    total: { amount: string; currency: string };
    placed_at: string | null;
    shipping_address: unknown;
    items: { title: string; quantity: number }[];
  }[];
  reviews: { product_id: string; rating: number; title: string | null; body: string | null; created_at: string }[];
}

/** Assemble everything we hold about a customer (Art. 15/20). */
export async function exportCustomerData(
  rlsDb: AppDb,
  tenantId: string,
  customer: Customer,
  exportedAtIso: string,
): Promise<CustomerDataExport> {
  return withTenant(rlsDb, tenantId, async (tx) => {
    const orders = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tenantId, tenantId),
          or(
            eq(schema.orders.customerId, customer.id),
            eq(schema.orders.customerEmail, customer.email),
          ),
        ),
      )
      .orderBy(desc(schema.orders.placedAt));

    const orderIds = orders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await tx
            .select({
              orderId: schema.orderItems.orderId,
              title: schema.orderItems.productTitleSnapshot,
              quantity: schema.orderItems.quantity,
            })
            .from(schema.orderItems)
            .where(eq(schema.orderItems.tenantId, tenantId))
        : [];
    const itemsByOrder = new Map<string, { title: string; quantity: number }[]>();
    for (const it of items) {
      if (!orderIds.includes(it.orderId)) continue;
      const arr = itemsByOrder.get(it.orderId) ?? [];
      arr.push({ title: it.title, quantity: it.quantity });
      itemsByOrder.set(it.orderId, arr);
    }

    const reviews = await tx
      .select()
      .from(schema.productReviews)
      .where(
        and(
          eq(schema.productReviews.tenantId, tenantId),
          eq(schema.productReviews.customerId, customer.id),
        ),
      );

    return {
      exported_at: exportedAtIso,
      profile: {
        email: customer.email,
        full_name: customer.fullName,
        phone: customer.phone,
        created_at: customer.createdAt.toISOString(),
        email_verified: Boolean(customer.emailVerifiedAt),
        default_address: customer.defaultAddress,
      },
      orders: orders.map((o) => ({
        number: o.orderNumber,
        status: o.status,
        payment_status: o.paymentStatus,
        total: { amount: o.totalAmount.toString(), currency: o.currency },
        placed_at: o.placedAt?.toISOString() ?? null,
        shipping_address: o.shippingAddress,
        items: itemsByOrder.get(o.id) ?? [],
      })),
      reviews: reviews.map((r) => ({
        product_id: r.productId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        created_at: r.createdAt.toISOString(),
      })),
    };
  });
}

export interface ErasureResult {
  ordersAnonymized: number;
  reviewsAnonymized: number;
  invoicesRetained: number;
}

/**
 * Erase a customer (Art. 17). Anonymizes contact/address/auth PII across
 * customers, orders, reviews, and revokes sessions — keeps invoices + order
 * financials for the legal retention period.
 */
export async function eraseCustomer(
  rlsDb: AppDb,
  tenantId: string,
  customer: Customer,
): Promise<ErasureResult> {
  const placeholderEmail = `erased_${customer.pubId.toLowerCase()}@deleted.invalid`;
  const now = new Date();

  return withTenant(rlsDb, tenantId, async (tx) => {
    // Orders tied to this customer (by id or their email) — redact contact PII,
    // keep amounts + numbers for accounting.
    const orders = await tx
      .update(schema.orders)
      .set({
        customerName: 'Smazaný zákazník',
        customerEmail: placeholderEmail,
        customerPhone: null,
        shippingAddress: { redacted: true },
        billingAddress: { redacted: true },
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.orders.tenantId, tenantId),
          or(
            eq(schema.orders.customerId, customer.id),
            eq(schema.orders.customerEmail, customer.email),
          ),
        ),
      )
      .returning({ id: schema.orders.id });

    // Count invoices retained for this customer's orders (legal basis —
    // immutable tax documents are NOT erased, Art. 17(3)(b)).
    const orderIds = orders.map((o) => o.id);
    const invoices =
      orderIds.length > 0
        ? await tx
            .select({ id: schema.invoices.id })
            .from(schema.invoices)
            .where(
              and(
                eq(schema.invoices.tenantId, tenantId),
                inArray(schema.invoices.orderId, orderIds),
              ),
            )
        : [];
    const retained = invoices.length;

    // Reviews — keep the rating/text (product feedback) but drop the name.
    const reviews = await tx
      .update(schema.productReviews)
      .set({ authorName: 'Anonymní zákazník', updatedAt: now })
      .where(
        and(
          eq(schema.productReviews.tenantId, tenantId),
          eq(schema.productReviews.customerId, customer.id),
        ),
      )
      .returning({ id: schema.productReviews.id });

    // Revoke all sessions.
    await tx
      .update(schema.customerSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(schema.customerSessions.tenantId, tenantId),
          eq(schema.customerSessions.customerId, customer.id),
        ),
      );

    // Finally anonymize the customer identity itself.
    await tx
      .update(schema.customers)
      .set({
        email: placeholderEmail,
        fullName: null,
        phone: null,
        passwordHash: null,
        status: 'disabled',
        defaultAddress: null,
        emailVerifiedAt: null,
        metadata: { erased_at: now.toISOString() },
        updatedAt: now,
      })
      .where(eq(schema.customers.id, customer.id));

    return {
      ordersAnonymized: orders.length,
      reviewsAnonymized: reviews.length,
      invoicesRetained: retained,
    };
  });
}
