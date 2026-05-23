/**
 * Admin orders endpoints — list, detail, status transitions.
 *
 * Per `16-order-management.md` + `36-personas-rbac.md`.
 * All endpoints require auth + permission `orders.read` / `orders.update`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, or, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { sendOrderPaidEmail } from '../lib/order-emails';
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

      const [existing] = await db
        .select({
          id: schema.orders.id,
          status: schema.orders.status,
          paymentStatus: schema.orders.paymentStatus,
        })
        .from(schema.orders)
        .where(
          and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, req.params.orderPubId)),
        )
        .limit(1);
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }

      // Validate transition (per `16 §RULE-ORD-005`)
      if (parsed.data.status) {
        if (!isValidTransition(existing.status, parsed.data.status)) {
          return reply.code(422).send({
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition from ${existing.status} → ${parsed.data.status}`,
            },
          });
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.status) {
        updates.status = parsed.data.status;
        updates.statusEnteredAt = new Date();
        if (parsed.data.status === 'paid' && existing.paymentStatus !== 'paid') {
          updates.paymentStatus = 'paid';
          updates.paidAt = new Date();
        }
        if (parsed.data.status === 'fulfilled') updates.fulfilledAt = new Date();
        if (parsed.data.status === 'cancelled') updates.cancelledAt = new Date();
      }
      if (parsed.data.paymentStatus) {
        updates.paymentStatus = parsed.data.paymentStatus;
        if (parsed.data.paymentStatus === 'paid') updates.paidAt = new Date();
      }

      const [updated] = await db
        .update(schema.orders)
        .set(updates)
        .where(eq(schema.orders.id, existing.id))
        .returning();

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

      // Trigger paid email when transitioning into paid (manual admin mark)
      if (
        (parsed.data.status === 'paid' || parsed.data.paymentStatus === 'paid') &&
        existing.paymentStatus !== 'paid'
      ) {
        void sendOrderPaidEmail({ db, config, log: app.log }, existing.id).catch((err) => {
          app.log.error({ err, orderId: existing.id }, 'order.paid_email_failed');
        });
      }

      return reply.send({ data: serializeOrder(updated!, items) });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

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
    totals: {
      subtotal: { amount: order.subtotalAmount.toString(), currency: order.currency },
      shipping: { amount: order.shippingAmount.toString(), currency: order.currency },
      tax: { amount: order.taxAmount.toString(), currency: order.currency },
      discount: { amount: order.discountAmount.toString(), currency: order.currency },
      total: { amount: order.totalAmount.toString(), currency: order.currency },
    },
    tax_included: order.priceIncludesTax,
    tax_breakdown: order.taxBreakdown,
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
