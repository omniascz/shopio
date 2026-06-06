/**
 * Admin orders endpoints — list, detail, status transitions.
 *
 * Per `16-order-management.md` + `36-personas-rbac.md`.
 * All endpoints require auth + permission `orders.read` / `orders.update`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, or, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { sendOrderPaidEmail } from '../lib/order-emails';
import { issueInvoiceForOrder } from '../lib/invoices';
import { clearReservationExpiry, releaseOrderReservations } from '../lib/inventory';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'partially_paid',
  'fulfilling',
  'fulfilled',
  'cancelled',
  'refunded',
] as const;

const PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded'] as const;

const ListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  q: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'oldest', 'total_desc', 'total_asc']).default('recent'),
});

const StatusUpdateBody = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  // ---------------------------------------------------------------------------
  // GET /admin/dashboard — merchant overview metrics (per `20-analytics` MVP)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/dashboard',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }

      const [todayOrders, pendingPayment, openReturns, lowStock, currencyRow] =
        await Promise.all([
          // Orders placed today + revenue from today's PAID orders
          db
            .select({
              count: dsql<number>`COUNT(*)::int`,
              revenue: dsql<string>`COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::text`,
            })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.tenantId, tenantId),
                dsql`${schema.orders.placedAt} >= date_trunc('day', now())`,
              ),
            ),
          db
            .select({ count: dsql<number>`COUNT(*)::int` })
            .from(schema.orders)
            .where(
              and(
                eq(schema.orders.tenantId, tenantId),
                eq(schema.orders.status, 'pending_payment'),
              ),
            ),
          db
            .select({ count: dsql<number>`COUNT(*)::int` })
            .from(schema.returns)
            .where(
              and(
                eq(schema.returns.tenantId, tenantId),
                dsql`${schema.returns.status} IN ('requested', 'received')`,
              ),
            ),
          // Sellable stock running out (available = on hand − reserved)
          db
            .select({
              sku: schema.productVariants.sku,
              title: schema.productVariants.title,
              productTitle: schema.products.title,
              productPubId: schema.products.pubId,
              available: dsql<number>`(${schema.productVariants.stockOnHand} - ${schema.productVariants.stockReserved})::int`,
            })
            .from(schema.productVariants)
            .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
            .where(
              and(
                eq(schema.productVariants.tenantId, tenantId),
                eq(schema.products.status, 'active'),
                dsql`${schema.productVariants.stockOnHand} - ${schema.productVariants.stockReserved} <= 5`,
                eq(schema.productVariants.allowBackorder, false),
              ),
            )
            .orderBy(
              dsql`${schema.productVariants.stockOnHand} - ${schema.productVariants.stockReserved} ASC`,
            )
            .limit(10),
          db
            .select({ currency: schema.tenants.defaultCurrency })
            .from(schema.tenants)
            .where(eq(schema.tenants.id, tenantId))
            .limit(1),
        ]);

      const currency = currencyRow[0]?.currency ?? 'CZK';
      return reply.send({
        data: {
          today: {
            orders: todayOrders[0]?.count ?? 0,
            revenue: { amount: todayOrders[0]?.revenue ?? '0', currency },
          },
          pending_payment: pendingPayment[0]?.count ?? 0,
          returns_action_needed: openReturns[0]?.count ?? 0,
          low_stock: lowStock.map((v) => ({
            product_id: v.productPubId,
            product_title: v.productTitle,
            variant_title: v.title,
            sku: v.sku,
            available: v.available,
          })),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/orders — list (tenant-scoped via auth)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/orders',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const auth = req.auth!;
      const tenantId = auth.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }

      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_FAILED', message: 'Invalid query params' },
        });
      }
      const { status, paymentStatus, q, limit, offset, sort } = parsed.data;

      const conditions = [eq(schema.orders.tenantId, tenantId)];
      if (status) conditions.push(eq(schema.orders.status, status));
      if (paymentStatus) conditions.push(eq(schema.orders.paymentStatus, paymentStatus));
      if (q) {
        const pat = '%' + q + '%';
        conditions.push(
          or(
            ilike(schema.orders.orderNumber, pat),
            ilike(schema.orders.customerEmail, pat),
            ilike(schema.orders.customerName, pat),
          )!,
        );
      }

      const order =
        sort === 'recent'
          ? desc(schema.orders.placedAt)
          : sort === 'oldest'
            ? asc(schema.orders.placedAt)
            : sort === 'total_desc'
              ? desc(schema.orders.totalAmount)
              : asc(schema.orders.totalAmount);

      const [rows, countRow] = await Promise.all([
        db
          .select({
            id: schema.orders.id,
            pubId: schema.orders.pubId,
            orderNumber: schema.orders.orderNumber,
            customerEmail: schema.orders.customerEmail,
            customerName: schema.orders.customerName,
            status: schema.orders.status,
            paymentStatus: schema.orders.paymentStatus,
            totalAmount: schema.orders.totalAmount,
            currency: schema.orders.currency,
            placedAt: schema.orders.placedAt,
          })
          .from(schema.orders)
          .where(and(...conditions))
          .orderBy(order)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: dsql<number>`COUNT(*)::int` })
          .from(schema.orders)
          .where(and(...conditions)),
      ]);

      const total = countRow[0]?.count ?? 0;

      return reply.send({
        data: {
          orders: rows.map((r) => ({
            id: r.pubId,
            number: r.orderNumber,
            customer_email: r.customerEmail,
            customer_name: r.customerName,
            status: r.status,
            payment_status: r.paymentStatus,
            total: { amount: r.totalAmount.toString(), currency: r.currency },
            placed_at: r.placedAt,
          })),
          total,
          offset,
          limit,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/orders/{orderPubId}
  // ---------------------------------------------------------------------------
  app.get<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const auth = req.auth!;
      const tenantId = auth.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(
          and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, req.params.orderPubId)),
        )
        .limit(1);
      if (!order) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }

      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id))
        .orderBy(asc(schema.orderItems.createdAt));

      return reply.send({
        data: serializeOrder(order, items),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/orders/{orderPubId}/status
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/status',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const auth = req.auth!;
      const tenantId = auth.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
        });
      }

      const parsed = StatusUpdateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid status update',
            field_errors: parsed.error.flatten().fieldErrors,
          },
        });
      }
      if (!parsed.data.status && !parsed.data.paymentStatus) {
        return reply.code(422).send({
          error: { code: 'EMPTY_UPDATE', message: 'No changes provided' },
        });
      }

      // Transition + inventory sync run in ONE transaction with the order row
      // locked FOR UPDATE — concurrent admin clicks / webhook races re-read
      // the fresh status and fail the transition check instead of double-applying.
      let result: Awaited<ReturnType<typeof applyTransition>>;
      try {
        result = await applyTransition(db, tenantId, req.params.orderPubId, parsed.data);
      } catch (err) {
        if (err instanceof TransitionError) {
          return reply.code(err.httpStatus).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
      const { existing, updated } = result;

      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, existing.id))
        .orderBy(asc(schema.orderItems.createdAt));

      app.log.info(
        {
          orderId: existing.id,
          tenantId,
          actor: auth.userId,
          from: existing.status,
          to: parsed.data.status ?? existing.status,
        },
        'order.status_updated',
      );

      // Trigger invoice + paid email when transitioning into paid (manual admin mark).
      // Invoice first so the email can attach the PDF (per `15 §3.5`).
      if (
        (parsed.data.status === 'paid' || parsed.data.paymentStatus === 'paid') &&
        existing.paymentStatus !== 'paid'
      ) {
        void (async () => {
          try {
            const issued = await issueInvoiceForOrder(db, existing.id);
            app.log.info(
              { orderId: existing.id, invoiceNumber: issued.invoice.number },
              'order.invoice_issued',
            );
          } catch (err) {
            app.log.error({ err, orderId: existing.id }, 'order.invoice_failed');
          }
          await sendOrderPaidEmail({ db, config, log: app.log }, existing.id).catch((err) => {
            app.log.error({ err, orderId: existing.id }, 'order.paid_email_failed');
          });
        })();
      }

      return reply.send({ data: serializeOrder(updated!, items) });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

class TransitionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
  }
}

interface TransitionInput {
  status?: string | undefined;
  paymentStatus?: string | undefined;
}

/**
 * Apply an admin status transition atomically: lock the order, validate the
 * transition against the FRESH status, guard cancellation of shipped orders,
 * and run the inventory sync (per `09`) in the same transaction.
 */
async function applyTransition(
  db: AppDb,
  tenantId: string,
  orderPubId: string,
  input: TransitionInput,
): Promise<{
  existing: { id: string; status: string; paymentStatus: string };
  updated: typeof schema.orders.$inferSelect;
}> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: schema.orders.id,
        status: schema.orders.status,
        paymentStatus: schema.orders.paymentStatus,
      })
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, orderPubId)))
      .for('update')
      .limit(1);
    if (!existing) {
      throw new TransitionError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Validate transition (per `16 §RULE-ORD-005`)
    if (input.status && !isValidTransition(existing.status, input.status)) {
      throw new TransitionError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${existing.status} → ${input.status}`,
      );
    }

    // Goods already with the carrier cannot be "cancelled" — that's the
    // returns/refunds workflow (per `16` + `17`).
    if (input.status === 'cancelled') {
      const [shipped] = await tx
        .select({ count: dsql<number>`COUNT(*)::int` })
        .from(schema.shipments)
        .where(
          and(
            eq(schema.shipments.orderId, existing.id),
            inArray(schema.shipments.status, ['handed_over', 'delivered']),
          ),
        );
      if ((shipped?.count ?? 0) > 0) {
        throw new TransitionError(
          'ORDER_HAS_SHIPPED_GOODS',
          'Order has shipments already handed to the carrier — use the returns workflow instead',
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status) {
      updates.status = input.status;
      updates.statusEnteredAt = new Date();
      if (input.status === 'paid' && existing.paymentStatus !== 'paid') {
        updates.paymentStatus = 'paid';
        updates.paidAt = new Date();
      }
      if (input.status === 'fulfilled') updates.fulfilledAt = new Date();
      if (input.status === 'cancelled') updates.cancelledAt = new Date();
    }
    if (input.paymentStatus) {
      updates.paymentStatus = input.paymentStatus;
      if (input.paymentStatus === 'paid') updates.paidAt = new Date();
    }

    const [updated] = await tx
      .update(schema.orders)
      .set(updates)
      .where(eq(schema.orders.id, existing.id))
      .returning();

    // Inventory sync (per `09`) — same tx, so a failure rolls back the
    // status change too (no leaked holds on a "cancelled" order).
    if (input.status === 'cancelled') {
      await releaseOrderReservations(tx, existing.id, 'order_cancelled');
    } else if (
      (input.status === 'paid' || input.paymentStatus === 'paid') &&
      existing.paymentStatus !== 'paid'
    ) {
      await clearReservationExpiry(tx, existing.id);
    }

    return { existing, updated: updated! };
  });
}

function serializeOrder(
  order: typeof schema.orders.$inferSelect,
  items: (typeof schema.orderItems.$inferSelect)[],
) {
  return {
    id: order.pubId,
    number: order.orderNumber,
    customer: {
      email: order.customerEmail,
      name: order.customerName,
      phone: order.customerPhone,
      locale: order.customerLocale,
    },
    shipping_address: order.shippingAddress,
    billing_address: order.billingAddress,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_method: order.paymentMethod,
    channel_kind: order.channelKind,
    // B2B (per `21`): present for company orders / NET-terms invoice payment.
    company: order.companySnapshot ?? null,
    purchase_order_number: order.purchaseOrderNumber,
    payment_terms_days: order.paymentTermsDays,
    due_at: order.dueAt,
    totals: {
      subtotal: { amount: order.subtotalAmount.toString(), currency: order.currency },
      shipping: { amount: order.shippingAmount.toString(), currency: order.currency },
      tax: { amount: order.taxAmount.toString(), currency: order.currency },
      discount: { amount: order.discountAmount.toString(), currency: order.currency },
      total: { amount: order.totalAmount.toString(), currency: order.currency },
    },
    tax_included: order.priceIncludesTax,
    tax_breakdown: order.taxBreakdown,
    shipping_method: order.shippingMethod,
    pickup_point: order.pickupPoint,
    customer_note: order.customerNote,
    placed_at: order.placedAt,
    paid_at: order.paidAt,
    fulfilled_at: order.fulfilledAt,
    cancelled_at: order.cancelledAt,
    items: items.map((it) => ({
      id: it.pubId,
      product_title: it.productTitleSnapshot,
      variant_title: it.variantTitleSnapshot,
      sku: it.skuSnapshot,
      quantity: it.quantity,
      unit_price: {
        amount: it.unitPriceAmount.toString(),
        currency: it.unitPriceCurrency,
      },
      line_subtotal: {
        amount: it.lineSubtotalAmount.toString(),
        currency: it.unitPriceCurrency,
      },
      tax_class: it.taxClassCode,
      tax_rate_basis_points: it.taxRateBasisPoints,
      line_tax: {
        amount: it.lineTaxAmount.toString(),
        currency: it.unitPriceCurrency,
      },
      line_total: {
        amount: it.lineTotalAmount.toString(),
        currency: it.unitPriceCurrency,
      },
    })),
  };
}

/**
 * Per `16-order-management.md §RULE-ORD-005` — allowed status transitions.
 * Simplified MVP state machine.
 */
function isValidTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    pending_payment: ['paid', 'partially_paid', 'cancelled'],
    partially_paid: ['paid', 'cancelled'],
    paid: ['fulfilling', 'fulfilled', 'refunded', 'cancelled'],
    fulfilling: ['fulfilled', 'cancelled', 'refunded'],
    fulfilled: ['refunded'],
    cancelled: [],
    refunded: [],
  };
  return (allowed[from] ?? []).includes(to);
}
