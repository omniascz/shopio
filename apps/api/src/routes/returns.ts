/**
 * Returns/refunds endpoints (admin) — per `17-returns-refunds.md` MVP.
 *
 *   GET  /admin/orders/{orderPubId}/returns        — list returns for an order
 *   POST /admin/orders/{orderPubId}/returns        — create (status=requested)
 *   POST /admin/returns/{returnPubId}/approve
 *   POST /admin/returns/{returnPubId}/reject       — { reason? }
 *   POST /admin/returns/{returnPubId}/receive
 *   POST /admin/returns/{returnPubId}/refund       — { refundShipping?, restock? }
 *
 * The refund step is the saga (JOB-PROCESS-RETURN-REFUND, sync MVP):
 * provider refund (Stripe / mock) → credit note → restock → order sync.
 * Provider call happens before the DB transaction; its idempotency key is the
 * return pub_id, so a crash between the two is safe to retry.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema, withTenant, type TenantTx } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import {
  ReturnError,
  computeShippingRefund,
  createReturn,
  isValidReturnTransition,
} from '../lib/returns';
import { issueCreditNote, type CreditNoteLine } from '../lib/invoices';
import { createRefund, isStripeEnabled } from '../lib/stripe';
import { restockReturn } from '../lib/inventory';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const CreateReturnBody = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(), // oit_ pub id
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
  reasonCode: z
    .enum(['changed_mind', 'damaged', 'wrong_item', 'not_as_described', 'other'])
    .default('other'),
  customerNote: z.string().max(2000).optional(),
  staffNote: z.string().max(2000).optional(),
});

const RejectBody = z.object({
  reason: z.string().max(2000).optional(),
});

const RefundBody = z.object({
  /** Also refund the order's shipping fee (full, gross). */
  refundShipping: z.boolean().default(false),
  /** Restock returned quantities back to stock_on_hand. */
  restock: z.boolean().default(true),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerReturnRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { config } = opts;
  const rlsDb = getRlsDb(config);

  // ---------------------------------------------------------------------------
  // GET /admin/returns — global queue across orders (per `17` FLOW-RTN-002)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/returns',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const Query = z.object({
        status: z
          .enum(['requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled'])
          .optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      });
      const parsed = Query.safeParse(req.query);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { status, limit, offset } = parsed.data;

      const conditions = [eq(schema.returns.tenantId, tenantId)];
      if (status) conditions.push(eq(schema.returns.status, status));

      const [rows, countRow, openRow] = await withTenant(rlsDb, tenantId, (tx) =>
        Promise.all([
          tx
            .select({
              ret: schema.returns,
              orderPubId: schema.orders.pubId,
              orderNumber: schema.orders.orderNumber,
              customerEmail: schema.orders.customerEmail,
              customerName: schema.orders.customerName,
            })
            .from(schema.returns)
            .innerJoin(schema.orders, eq(schema.orders.id, schema.returns.orderId))
            .where(and(...conditions))
            .orderBy(desc(schema.returns.requestedAt))
            .limit(limit)
            .offset(offset),
          tx
            .select({ count: dsql<number>`COUNT(*)::int` })
            .from(schema.returns)
            .where(and(...conditions)),
          // Action-needed counter for the nav badge (requested + received)
          tx
            .select({ count: dsql<number>`COUNT(*)::int` })
            .from(schema.returns)
            .where(
              and(
                eq(schema.returns.tenantId, tenantId),
                inArray(schema.returns.status, ['requested', 'received']),
              ),
            ),
        ]),
      );

      return reply.send({
        data: {
          returns: rows.map((r) => ({
            id: r.ret.pubId,
            number: r.ret.number,
            status: r.ret.status,
            reason_code: r.ret.reasonCode,
            customer_note: r.ret.customerNote,
            requested_refund: {
              amount: r.ret.requestedRefundAmount.toString(),
              currency: r.ret.currency,
            },
            actual_refund: r.ret.actualRefundAmount
              ? { amount: r.ret.actualRefundAmount.toString(), currency: r.ret.currency }
              : null,
            requested_at: r.ret.requestedAt,
            order: {
              id: r.orderPubId,
              number: r.orderNumber,
              customer_email: r.customerEmail,
              customer_name: r.customerName,
            },
          })),
          total: countRow[0]?.count ?? 0,
          action_needed: openRow[0]?.count ?? 0,
          offset,
          limit,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/orders/{orderPubId}/returns
  // ---------------------------------------------------------------------------
  app.get<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/returns',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const order = await findOrder(tx, tenantId, req.params.orderPubId);
        if (!order) return null;
        const rows = await tx
          .select()
          .from(schema.returns)
          .where(eq(schema.returns.orderId, order.id))
          .orderBy(asc(schema.returns.requestedAt));
        const items = rows.length
          ? await tx
              .select()
              .from(schema.returnItems)
              .where(
                inArray(
                  schema.returnItems.returnId,
                  rows.map((r) => r.id),
                ),
              )
              .orderBy(asc(schema.returnItems.createdAt))
          : [];
        return { rows, items };
      });
      if (!result) return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');
      const { rows, items } = result;

      return reply.send({
        data: {
          returns: rows.map((r) =>
            serializeReturn(
              r,
              items.filter((i) => i.returnId === r.id),
            ),
          ),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/orders/{orderPubId}/returns
  // ---------------------------------------------------------------------------
  app.post<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/returns',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const auth = req.auth!;
      const tenantId = auth.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = CreateReturnBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const order = await withTenant(rlsDb, tenantId, (tx) =>
        findOrder(tx, tenantId, req.params.orderPubId),
      );
      if (!order) return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');

      try {
        const result = await createReturn(rlsDb, {
          tenantId,
          orderId: order.id,
          items: input.items.map((it) => ({
            orderItemPubId: it.orderItemId,
            quantity: it.quantity,
          })),
          reasonCode: input.reasonCode,
          customerNote: input.customerNote ?? null,
          staffNote: input.staffNote ?? null,
          createdByUserId: auth.userId,
        });

        app.log.info(
          { returnId: result.ret.id, orderId: order.id, number: result.ret.number },
          'return.created',
        );
        return reply.code(201).send({ data: serializeReturn(result.ret, result.items) });
      } catch (err) {
        if (err instanceof ReturnError) {
          return reply.code(422).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Status transitions: approve / reject / receive / cancel
  // ---------------------------------------------------------------------------
  for (const [action, target, timestampCol] of [
    ['approve', 'approved', 'approvedAt'],
    ['reject', 'rejected', 'rejectedAt'],
    ['receive', 'received', 'receivedAt'],
    ['cancel', 'cancelled', 'cancelledAt'],
  ] as const) {
    app.post<{ Params: { returnPubId: string } }>(
      `/api/2026-05-20/admin/returns/:returnPubId/${action}`,
      { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
      async (req, reply) => {
        const tenantId = req.auth!.tenantId;
        if (!tenantId) return noTenant(reply);

        const reason =
          action === 'reject' ? (RejectBody.safeParse(req.body ?? {}).data?.reason ?? null) : null;

        const found = await withTenant(rlsDb, tenantId, (tx) =>
          findReturn(tx, tenantId, req.params.returnPubId),
        );
        if (!found) return notFound(reply, 'RETURN_NOT_FOUND', 'Return not found');

        if (!isValidReturnTransition(found.status, target)) {
          return reply.code(422).send({
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition from ${found.status} → ${target}`,
            },
          });
        }

        const { updated, items } = await withTenant(rlsDb, tenantId, async (tx) => {
          const [u] = await tx
            .update(schema.returns)
            .set({
              status: target,
              statusEnteredAt: new Date(),
              [timestampCol]: new Date(),
              ...(reason && { staffNote: reason }),
              updatedAt: new Date(),
            })
            .where(eq(schema.returns.id, found.id))
            .returning();
          const its = await listReturnItems(tx, found.id);
          return { updated: u, items: its };
        });
        app.log.info(
          { returnId: found.id, from: found.status, to: target },
          'return.status_updated',
        );
        return reply.send({ data: serializeReturn(updated!, items) });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // POST /admin/returns/{returnPubId}/refund — the saga
  // ---------------------------------------------------------------------------
  app.post<{ Params: { returnPubId: string } }>(
    '/api/2026-05-20/admin/returns/:returnPubId/refund',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = RefundBody.safeParse(req.body ?? {});
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { refundShipping, restock } = parsed.data;

      // The whole saga runs in ONE transaction with the return + order rows
      // locked FOR UPDATE: concurrent refund clicks block, the loser re-reads
      // status='refunded' and aborts; credit-note failure rolls everything
      // back (the executed provider refund is retry-safe — Stripe idempotency
      // key + deterministic mock reference both collapse on retry).
      let creditNoteNumber: string | null = null;
      try {
        const result = await withTenant(rlsDb, tenantId, async (tx) => {
          const [found] = await tx
            .select()
            .from(schema.returns)
            .where(
              and(
                eq(schema.returns.tenantId, tenantId),
                eq(schema.returns.pubId, req.params.returnPubId),
              ),
            )
            .for('update')
            .limit(1);
          if (!found) throw new ReturnError('RETURN_NOT_FOUND', 'Return not found');
          if (!isValidReturnTransition(found.status, 'refunded')) {
            throw new ReturnError(
              'INVALID_STATUS_TRANSITION',
              `Refund requires status received (current: ${found.status})`,
            );
          }

          const [order] = await tx
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, found.orderId))
            .for('update')
            .limit(1);
          if (!order) throw new ReturnError('ORDER_NOT_FOUND', 'Order not found');
          // Order must still hold a captured, not-yet-fully-refunded payment
          if (order.paymentStatus !== 'paid') {
            throw new ReturnError(
              'ORDER_NOT_REFUNDABLE',
              `Order payment status is ${order.paymentStatus}`,
            );
          }

          const [tenant] = await tx
            .select({ shippingTaxClass: schema.tenants.shippingTaxClass })
            .from(schema.tenants)
            .where(eq(schema.tenants.id, tenantId))
            .limit(1);

          const items = await listReturnItems(tx, found.id);
          const itemsGross = items.reduce((s, i) => s + i.lineGrossAmount, 0n);

          // Shipping refund — once per order across all returns
          let shipping = { gross: 0n, net: 0n, tax: 0n };
          if (refundShipping && order.shippingAmount > 0n) {
            const [prior] = await tx
              .select({
                refunded: dsql<string>`COALESCE(SUM(${schema.returns.shippingRefundAmount}), 0)::text`,
              })
              .from(schema.returns)
              .where(
                and(
                  eq(schema.returns.orderId, order.id),
                  eq(schema.returns.status, 'refunded'),
                ),
              );
            if (BigInt(prior?.refunded ?? '0') > 0n) {
              throw new ReturnError(
                'SHIPPING_ALREADY_REFUNDED',
                'Shipping was already refunded by a previous return on this order',
              );
            }
            const orderItemsRows = await tx
              .select({ lineTaxAmount: schema.orderItems.lineTaxAmount })
              .from(schema.orderItems)
              .where(eq(schema.orderItems.orderId, order.id));
            const orderItemTaxSum = orderItemsRows.reduce((s, r) => s + r.lineTaxAmount, 0n);
            shipping = computeShippingRefund({
              shippingAmount: order.shippingAmount,
              taxAmount: order.taxAmount,
              orderItemTaxSum,
            });
          }

          const refundTotal = itemsGross + shipping.gross;
          const remainingRefundable = order.totalAmount - order.refundedAmount;
          if (refundTotal > remainingRefundable) {
            throw new ReturnError(
              'REFUND_EXCEEDS_REMAINING',
              `Refund ${refundTotal} exceeds remaining refundable ${remainingRefundable}`,
            );
          }

          // Provider refund. Inside the tx on purpose: the row locks make the
          // call single-flight per return, and a rollback after success is
          // safe to retry (idempotent at the provider). MVP trade-off — moves
          // to an outbox/worker with the BullMQ wave.
          const orderMeta = (order.metadata ?? {}) as { stripe_payment_intent_id?: string };
          let refundMethod: string;
          let refundReference: string;
          if (
            isStripeEnabled(config) &&
            order.paymentMethod === 'stripe' &&
            orderMeta.stripe_payment_intent_id
          ) {
            const res = await createRefund(config, {
              paymentIntentId: orderMeta.stripe_payment_intent_id,
              amountMinor: refundTotal,
              idempotencyKey: `refund_${found.pubId}`,
            });
            refundMethod = 'stripe';
            refundReference = res.refundId;
          } else {
            refundMethod = 'mock';
            refundReference = `re_mock_${found.pubId}`;
          }

          // Credit note (dobropis) — RULE-RTN-014. A failure here throws and
          // rolls back the whole saga (return stays `received`, retry-safe).
          const creditLines: CreditNoteLine[] = items.map((i) => ({
            sku: i.skuSnapshot,
            title: i.titleSnapshot,
            quantity: i.quantity,
            unitPriceAmount: i.unitGrossAmount,
            netAmount: i.lineNetAmount,
            taxClassCode: i.taxClassCode,
            taxRateBasisPoints: i.taxRateBasisPoints,
            taxAmount: i.lineTaxAmount,
            grossAmount: i.lineGrossAmount,
          }));
          if (shipping.gross > 0n) {
            const method = order.shippingMethod as { display_name?: string } | null;
            creditLines.push({
              sku: null,
              title: method?.display_name ? `Doprava — ${method.display_name}` : 'Doprava',
              quantity: 1,
              unitPriceAmount: shipping.gross,
              netAmount: shipping.net,
              taxClassCode: tenant?.shippingTaxClass ?? 'standard',
              taxRateBasisPoints:
                shipping.net > 0n
                  ? Math.round(Number(shipping.tax) / Number(shipping.net) / 0.01) * 100
                  : 0,
              taxAmount: shipping.tax,
              grossAmount: shipping.gross,
            });
          }
          const issued = await issueCreditNote(tx, order.id, creditLines, {
            reason: `Vratka ${found.number} k objednávce ${order.orderNumber}`,
          });
          creditNoteNumber = issued.invoice.number;

          // Finalize: return row + restock + order sync
          const [updated] = await tx
            .update(schema.returns)
            .set({
              status: 'refunded',
              statusEnteredAt: new Date(),
              refundedAt: new Date(),
              shippingRefundAmount: shipping.gross,
              actualRefundAmount: refundTotal,
              refundMethod,
              refundReference,
              creditNoteInvoiceId: issued.invoice.id,
              updatedAt: new Date(),
            })
            .where(eq(schema.returns.id, found.id))
            .returning();

          if (restock) {
            for (const i of items) {
              if (!i.variantId || i.restocked) continue;
              // Physical stock-in via the ledger (per `09`: reason='return')
              await restockReturn(tx, {
                tenantId,
                variantId: i.variantId,
                quantity: i.quantity,
                returnId: found.id,
                actorUserId: req.auth!.userId,
              });
              await tx
                .update(schema.returnItems)
                .set({ restocked: true, restockedAt: new Date() })
                .where(eq(schema.returnItems.id, i.id));
            }
          }

          // Order sync (RULE-RTN-015): cumulative refunded amount + full-refund status
          const newRefunded = order.refundedAmount + refundTotal;
          const fullyRefunded = newRefunded >= order.totalAmount;
          await tx
            .update(schema.orders)
            .set({
              refundedAmount: newRefunded,
              ...(fullyRefunded && {
                status: 'refunded' as const,
                statusEnteredAt: new Date(),
                paymentStatus: 'refunded' as const,
              }),
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, order.id));

          return { updated: updated!, refundTotal, refundMethod };
        });

        const finalItems = await withTenant(rlsDb, tenantId, (tx) =>
          listReturnItems(tx, result.updated.id),
        );
        app.log.info(
          {
            returnId: result.updated.id,
            amount: result.refundTotal.toString(),
            method: result.refundMethod,
            creditNote: creditNoteNumber,
          },
          'return.refunded',
        );
        return reply.send({
          data: {
            ...serializeReturn(result.updated, finalItems),
            credit_note_number: creditNoteNumber,
          },
        });
      } catch (err) {
        if (err instanceof ReturnError) {
          const status = err.code === 'RETURN_NOT_FOUND' || err.code === 'ORDER_NOT_FOUND' ? 404 : 422;
          return reply.code(status).send({ error: { code: err.code, message: err.message } });
        }
        app.log.error({ err, returnPubId: req.params.returnPubId }, 'return.refund_failed');
        return reply.code(502).send({
          error: {
            code: 'REFUND_FAILED',
            message:
              'Refund failed and was rolled back. Retry is safe (provider call is idempotent).',
          },
        });
      }
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

async function findOrder(db: AppDb | TenantTx, tenantId: string, orderPubId: string) {
  const [order] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, orderPubId)))
    .limit(1);
  return order ?? null;
}

/** Root db or transaction — both expose the query builder. */
type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

async function findReturn(db: DbConn, tenantId: string, returnPubId: string) {
  const [ret] = await db
    .select()
    .from(schema.returns)
    .where(and(eq(schema.returns.tenantId, tenantId), eq(schema.returns.pubId, returnPubId)))
    .limit(1);
  return ret ?? null;
}

async function listReturnItems(db: DbConn, returnId: string) {
  return db
    .select()
    .from(schema.returnItems)
    .where(eq(schema.returnItems.returnId, returnId))
    .orderBy(asc(schema.returnItems.createdAt));
}

function serializeReturn(
  ret: typeof schema.returns.$inferSelect,
  items: (typeof schema.returnItems.$inferSelect)[],
) {
  return {
    id: ret.pubId,
    number: ret.number,
    status: ret.status,
    reason_code: ret.reasonCode,
    customer_note: ret.customerNote,
    staff_note: ret.staffNote,
    currency: ret.currency,
    requested_refund: { amount: ret.requestedRefundAmount.toString(), currency: ret.currency },
    shipping_refund: { amount: ret.shippingRefundAmount.toString(), currency: ret.currency },
    actual_refund: ret.actualRefundAmount
      ? { amount: ret.actualRefundAmount.toString(), currency: ret.currency }
      : null,
    refund_method: ret.refundMethod,
    refund_reference: ret.refundReference,
    requested_at: ret.requestedAt,
    approved_at: ret.approvedAt,
    received_at: ret.receivedAt,
    refunded_at: ret.refundedAt,
    rejected_at: ret.rejectedAt,
    cancelled_at: ret.cancelledAt,
    items: items.map((i) => ({
      id: i.pubId,
      title: i.titleSnapshot,
      sku: i.skuSnapshot,
      quantity: i.quantity,
      line_gross: { amount: i.lineGrossAmount.toString(), currency: ret.currency },
      line_tax: { amount: i.lineTaxAmount.toString(), currency: ret.currency },
      restocked: i.restocked,
    })),
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({
    error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' },
  });
}

function notFound(reply: any, code: string, message: string) {
  return reply.code(404).send({ error: { code, message } });
}

function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  });
}
