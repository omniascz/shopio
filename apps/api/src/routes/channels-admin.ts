/**
 * Admin sales channels + manual order entry — per `22-multistore-channels.md` MVP.
 *
 *   GET   /admin/channels                 — list channels
 *   PATCH /admin/channels/{pubId}         — rename / activate / deactivate
 *   POST  /admin/orders/manual            — create an order off-web (phone/email),
 *                                           attributed to the 'manual' channel
 *
 * The manual-order flow is what makes channels real: it lets staff record a
 * sale that never went through the web checkout (a phone order, a market stall)
 * with the same tax engine, numbering, and stock reservation as the storefront.
 *
 * Deferred (per `22`): multi-store (domains/themes), POS terminals & sessions,
 * marketplace feeds, per-channel pricing/payment/shipping overrides.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { withTenant } from '@shopio/db';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import { serializeChannel } from '../lib/channels';
import { computeTax, serializeBreakdown } from '../lib/tax';
import { resolveRates } from '../lib/tax-resolver';
import { reserveStock, availableQuantity } from '../lib/inventory';
import { issueInvoiceForOrder } from '../lib/invoices';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const ChannelUpdateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

const ManualOrderBody = z.object({
  customerEmail: z.string().email().toLowerCase(),
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().max(40).optional(),
  shippingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    countryCode: z.string().length(2),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1), // prv_ pubId or UUID
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
  /** Optional flat shipping charge (minor units, gross). */
  shippingAmount: z.union([z.string(), z.number()]).transform((v) => BigInt(v)).optional(),
  shippingLabel: z.string().max(120).optional(),
  customerNote: z.string().max(2000).optional(),
  /** Mark the order paid immediately (cash/transfer already received). */
  markPaid: z.boolean().default(false),
});

export async function registerChannelAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  // `db` (superuser) is used by the manual-order flow below (own transaction +
  // libs that open their own transactions). The channel CRUD uses the
  // RLS-enforced pool. Both are correct; full migration tracked as follow-up.
  const { db } = opts;
  const rlsDb = getRlsDb(opts.config);

  // ---------------------------------------------------------------------------
  // GET /admin/channels
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/admin/channels',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select({
            channel: schema.channels,
            orders: dsql<number>`(
              SELECT count(*)::int FROM ${schema.orders}
              WHERE ${schema.orders.channelId} = ${schema.channels.id}
            )`,
          })
          .from(schema.channels)
          .where(eq(schema.channels.tenantId, tenantId))
          .orderBy(asc(schema.channels.createdAt)),
      );
      return reply.send({
        data: { channels: rows.map((r) => ({ ...serializeChannel(r.channel), orders: r.orders })) },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/channels/{pubId}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/channels/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = ChannelUpdateBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

      const [updated] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .update(schema.channels)
          .set(updates)
          .where(and(eq(schema.channels.tenantId, tenantId), eq(schema.channels.pubId, req.params.pubId)))
          .returning(),
      );
      if (!updated) return notFound(reply, 'CHANNEL_NOT_FOUND');
      return reply.send({ data: serializeChannel(updated) });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/orders/manual — staff-entered order (phone/email/market).
  // ---------------------------------------------------------------------------
  app.post(
    '/api/2026-05-20/admin/orders/manual',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = ManualOrderBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [tenant] = await db
        .select({
          id: schema.tenants.id,
          defaultLocale: schema.tenants.defaultLocale,
          defaultCurrency: schema.tenants.defaultCurrency,
          countryCode: schema.tenants.countryCode,
          priceIncludesTax: schema.tenants.priceIncludesTax,
          shippingTaxClass: schema.tenants.shippingTaxClass,
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      if (!tenant) return noTenant(reply);

      // Resolve the 'manual' channel (must exist + be active).
      const [channel] = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.channels)
          .where(and(eq(schema.channels.tenantId, tenantId), eq(schema.channels.code, 'manual')))
          .limit(1),
      );
      if (!channel || !channel.isActive) {
        return reply.code(422).send({
          error: { code: 'CHANNEL_INACTIVE', message: 'Kanál „Ruční objednávka" není aktivní' },
        });
      }

      // Resolve variants (by pub_id or UUID) + product tax class + title.
      const ids = input.items.map((i) => i.variantId);
      const variants = await withTenant(rlsDb, tenantId, (tx) =>
        tx
        .select({
          id: schema.productVariants.id,
          pubId: schema.productVariants.pubId,
          productId: schema.productVariants.productId,
          sku: schema.productVariants.sku,
          title: schema.productVariants.title,
          priceAmount: schema.productVariants.priceAmount,
          priceCurrency: schema.productVariants.priceCurrency,
          stockOnHand: schema.productVariants.stockOnHand,
          stockReserved: schema.productVariants.stockReserved,
          allowBackorder: schema.productVariants.allowBackorder,
          productTitle: schema.products.title,
          taxClassCode: schema.products.taxClassCode,
        })
        .from(schema.productVariants)
        .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
        .where(
          and(
            eq(schema.productVariants.tenantId, tenantId),
            inArray(
              schema.productVariants.pubId,
              ids,
            ),
          ),
        ),
      );
      // Allow UUID lookups too (fallback).
      const byPub = new Map(variants.map((v) => [v.pubId, v]));
      const byUuid = new Map(variants.map((v) => [v.id, v]));
      const resolved = input.items.map((it) => ({
        line: it,
        v: byPub.get(it.variantId) ?? byUuid.get(it.variantId) ?? null,
      }));
      const missing = resolved.find((r) => !r.v);
      if (missing) {
        return reply.code(422).send({
          error: { code: 'VARIANT_NOT_FOUND', message: `Varianta ${missing.line.variantId} nenalezena` },
        });
      }

      const currency = tenant.defaultCurrency.toUpperCase();
      const country = input.shippingAddress.countryCode.toUpperCase();
      const shippingGross = input.shippingAmount ?? 0n;

      // Tax (same engine as web checkout) — ship-to country, gross-inclusive.
      const rates = await resolveRates(db, tenant.id, country, tenant.countryCode);
      const tax = computeTax({
        lines: resolved.map((r) => ({
          ref: r.v!.pubId,
          amount: r.v!.priceAmount * BigInt(r.line.quantity),
          taxClassCode: r.v!.taxClassCode,
        })),
        shippingAmount: shippingGross,
        shippingTaxClass: tenant.shippingTaxClass,
        rates,
        priceIncludesTax: tenant.priceIncludesTax,
      });
      const taxByRef = new Map(tax.lines.map((l) => [l.ref, l]));
      const grossGoods = resolved.reduce(
        (s, r) => s + r.v!.priceAmount * BigInt(r.line.quantity),
        0n,
      );
      const total = grossGoods + shippingGross;

      try {
        const result = await withTenant(rlsDb, tenantId, async (tx) => {
          // Lock + revalidate stock.
          const fresh = await tx
            .select({
              id: schema.productVariants.id,
              title: schema.productVariants.title,
              stockOnHand: schema.productVariants.stockOnHand,
              stockReserved: schema.productVariants.stockReserved,
              allowBackorder: schema.productVariants.allowBackorder,
            })
            .from(schema.productVariants)
            .where(inArray(schema.productVariants.id, resolved.map((r) => r.v!.id)))
            .for('update');
          const freshMap = new Map(fresh.map((f) => [f.id, f]));
          for (const r of resolved) {
            const f = freshMap.get(r.v!.id)!;
            if (availableQuantity(f) < r.line.quantity && !f.allowBackorder) {
              throw new ManualOrderError(
                'INSUFFICIENT_STOCK',
                `Nedostatek skladem: ${f.title} (k dispozici ${availableQuantity(f)}, požadováno ${r.line.quantity})`,
                409,
              );
            }
          }

          const orderNumber = await generateOrderNumber(tx, tenant.id);
          const now = new Date();
          const paid = input.markPaid;

          const [order] = await tx
            .insert(schema.orders)
            .values({
              tenantId: tenant.id,
              pubId: generatePubId('ord'),
              orderNumber,
              customerEmail: input.customerEmail,
              customerName: input.customerName,
              customerPhone: input.customerPhone ?? null,
              shippingAddress: input.shippingAddress,
              billingAddress: input.shippingAddress,
              currency,
              subtotalAmount: grossGoods,
              shippingAmount: shippingGross,
              shippingMethod: shippingGross > 0n
                ? { display_name: input.shippingLabel ?? 'Doprava', amount: shippingGross.toString() }
                : null,
              taxAmount: tax.totals.taxAmount,
              priceIncludesTax: tenant.priceIncludesTax,
              taxBreakdown: serializeBreakdown(tax.breakdown),
              totalAmount: total,
              status: paid ? 'paid' : 'pending_payment',
              paymentStatus: paid ? 'paid' : 'pending',
              paymentMethod: 'manual',
              paidAt: paid ? now : null,
              channelKind: 'manual',
              channelId: channel.id,
              customerLocale: tenant.defaultLocale,
              customerNote: input.customerNote ?? null,
            })
            .returning();
          if (!order) throw new ManualOrderError('ORDER_INSERT_FAILED', 'Could not create order');

          await tx.insert(schema.orderItems).values(
            resolved.map((r) => {
              const lineGross = r.v!.priceAmount * BigInt(r.line.quantity);
              const lt = taxByRef.get(r.v!.pubId);
              return {
                tenantId: tenant.id,
                orderId: order.id,
                pubId: generatePubId('oit'),
                variantId: r.v!.id,
                productId: r.v!.productId,
                productTitleSnapshot: r.v!.productTitle,
                variantTitleSnapshot: r.v!.title,
                skuSnapshot: r.v!.sku,
                quantity: r.line.quantity,
                unitPriceAmount: r.v!.priceAmount,
                unitPriceCurrency: r.v!.priceCurrency,
                lineSubtotalAmount: lt?.baseAmount ?? lineGross,
                lineDiscountAmount: 0n,
                taxClassCode: lt?.taxClassCode ?? r.v!.taxClassCode,
                taxRateBasisPoints: lt?.taxRateBasisPoints ?? 0,
                lineTaxAmount: lt?.taxAmount ?? 0n,
                lineTotalAmount: lineGross,
              };
            }),
          );

          // Reserve stock. Manual orders are merchant-managed → no auto-expiry.
          await reserveStock(tx, {
            tenantId: tenant.id,
            orderId: order.id,
            lines: resolved.map((r) => ({ variantId: r.v!.id, quantity: r.line.quantity })),
            expiresAt: null,
          });

          return order;
        });

        app.log.info(
          { orderId: result.id, tenantId, channel: 'manual', actor: req.auth!.userId },
          'order.manual_created',
        );

        // Issue invoice for paid manual orders (same as web mark-paid path).
        if (input.markPaid) {
          void issueInvoiceForOrder(rlsDb, tenantId, result.id).catch((err) => {
            app.log.error({ err, orderId: result.id }, 'order.manual_invoice_failed');
          });
        }

        return reply.code(201).send({
          data: {
            order: {
              id: result.pubId,
              number: result.orderNumber,
              status: result.status,
              payment_status: result.paymentStatus,
              total: { amount: result.totalAmount.toString(), currency: result.currency },
              channel: 'manual',
              placed_at: result.placedAt,
            },
          },
        });
      } catch (err) {
        if (err instanceof ManualOrderError) {
          return reply.code(err.httpStatus).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );
}

class ManualOrderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
  }
}

async function generateOrderNumber(
  tx: { select: AppDb['select']; execute: AppDb['execute'] },
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  await tx.execute(dsql`SELECT pg_advisory_xact_lock(hashtext(${`ord:${tenantId}:${year}`}))`);
  const [row] = await tx
    .select({ count: dsql<number>`COUNT(*)::int` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, tenantId),
        dsql`EXTRACT(YEAR FROM ${schema.orders.placedAt}) = ${year}`,
      ),
    );
  const seq = (row?.count ?? 0) + 1;
  return `ORD-${year}-${String(seq).padStart(8, '0')}`;
}

function noTenant(reply: any) {
  return reply.code(403).send({ error: { code: 'NO_TENANT', message: 'No active tenant' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
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
