/**
 * Shipment/fulfillment endpoints — per `14-shipping.md` §3.1 + `16-order-management.md`.
 *
 * Admin:
 *   GET    /admin/orders/{orderPubId}/shipments
 *   POST   /admin/orders/{orderPubId}/shipments      — create (status=pending)
 *   POST   /admin/shipments/{pubId}/label            — Packeta createPacket → label
 *   GET    /admin/shipments/{pubId}/label.pdf
 *   POST   /admin/shipments/{pubId}/handed-over      — fulfillment commit + email
 *   POST   /admin/shipments/{pubId}/delivered        — manual tracking close (MVP)
 *   POST   /admin/shipments/{pubId}/cancel           — pre-handover only
 *
 * Storefront (orderNumber + ?email= bearer convention):
 *   GET    /storefront/{tenantSlug}/orders/{orderNumber}/tracking
 *
 * Fulfillment commit happens at handover (RULE-SHIP-006 adapted: CZ shops mark
 * "vyřízeno" when goods leave): order_items.quantity_fulfilled += shipped, and
 * when every line is fully fulfilled the order flips to `fulfilled`.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import {
  ShipmentError,
  computeShipmentWeight,
  formatShipmentNumber,
  isValidShipmentTransition,
  shippableQuantity,
  splitRecipientName,
} from '../lib/shipments';
import { createPacket, getLabelPdf, trackingUrlFor } from '../lib/packeta';
import { renderOrderShippedEmail, sendEmail } from '../lib/email';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const CreateShipmentBody = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(), // oit_ pub id
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
  internalNote: z.string().max(2000).optional(),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerShipmentRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const { db, config } = opts;

  // ---------------------------------------------------------------------------
  // GET /admin/orders/{orderPubId}/shipments
  // ---------------------------------------------------------------------------
  app.get<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/shipments',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const order = await findOrderByPubId(db, tenantId, req.params.orderPubId);
      if (!order) return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');

      const rows = await db
        .select()
        .from(schema.shipments)
        .where(eq(schema.shipments.orderId, order.id))
        .orderBy(asc(schema.shipments.createdAt));
      const items = rows.length
        ? await db
            .select()
            .from(schema.shipmentItems)
            .where(
              inArray(
                schema.shipmentItems.shipmentId,
                rows.map((r) => r.id),
              ),
            )
        : [];

      return reply.send({
        data: {
          shipments: rows.map((r) =>
            serializeShipment(
              r,
              items.filter((i) => i.shipmentId === r.id),
            ),
          ),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/orders/{orderPubId}/shipments
  // ---------------------------------------------------------------------------
  app.post<{ Params: { orderPubId: string } }>(
    '/api/2026-05-20/admin/orders/:orderPubId/shipments',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const auth = req.auth!;
      const tenantId = auth.tenantId;
      if (!tenantId) return noTenant(reply);

      const parsed = CreateShipmentBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(
          and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, req.params.orderPubId)),
        )
        .limit(1);
      if (!order) return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');
      if (order.status !== 'paid' && order.status !== 'fulfilling') {
        return reply.code(422).send({
          error: {
            code: 'ORDER_NOT_FULFILLABLE',
            message: `Shipments require a paid order (current: ${order.status})`,
          },
        });
      }

      const orderItems = await db
        .select({
          item: schema.orderItems,
          weightGrams: schema.productVariants.weightGrams,
        })
        .from(schema.orderItems)
        .leftJoin(
          schema.productVariants,
          eq(schema.productVariants.id, schema.orderItems.variantId),
        )
        .where(eq(schema.orderItems.orderId, order.id));
      const itemsByPubId = new Map(orderItems.map((r) => [r.item.pubId, r]));

      // Prior holds (live shipments) per order item
      const prior = await db
        .select({
          orderItemId: schema.shipmentItems.orderItemId,
          quantity: schema.shipmentItems.quantity,
          status: schema.shipments.status,
        })
        .from(schema.shipmentItems)
        .innerJoin(schema.shipments, eq(schema.shipments.id, schema.shipmentItems.shipmentId))
        .where(eq(schema.shipments.orderId, order.id));

      const method = order.shippingMethod as {
        carrier_code?: string;
        service_code?: string;
        display_name?: string;
      } | null;

      try {
        const result = await db.transaction(async (tx) => {
          const lines = input.items.map((reqItem) => {
            const row = itemsByPubId.get(reqItem.orderItemId);
            if (!row) {
              throw new ShipmentError(
                'ORDER_ITEM_NOT_FOUND',
                `Unknown item ${reqItem.orderItemId}`,
              );
            }
            const remaining = shippableQuantity(
              row.item.quantity,
              prior.filter((p) => p.orderItemId === row.item.id),
            );
            if (reqItem.quantity > remaining) {
              throw new ShipmentError(
                'QUANTITY_EXCEEDS_SHIPPABLE',
                `${row.item.productTitleSnapshot}: shippable ${remaining}, requested ${reqItem.quantity}`,
              );
            }
            return { row, quantity: reqItem.quantity };
          });

          const weight = computeShipmentWeight(
            lines.map((l) => ({ quantity: l.quantity, weightGrams: l.row.weightGrams })),
          );

          const year = new Date().getFullYear();
          const [cnt] = await tx
            .select({ count: dsql<number>`COUNT(*)::int` })
            .from(schema.shipments)
            .where(
              and(
                eq(schema.shipments.tenantId, tenantId),
                dsql`EXTRACT(YEAR FROM ${schema.shipments.createdAt}) = ${year}`,
              ),
            );
          const number = formatShipmentNumber(year, (cnt?.count ?? 0) + 1);

          const [shipment] = await tx
            .insert(schema.shipments)
            .values({
              tenantId,
              pubId: generatePubId('shp'),
              orderId: order.id,
              number,
              carrierCode: method?.carrier_code ?? 'zasilkovna',
              serviceCode: method?.service_code ?? (order.pickupPoint ? 'pickup_point' : 'home_delivery'),
              shippingAddressSnapshot: order.shippingAddress,
              pickupPointSnapshot: order.pickupPoint,
              weightGrams: weight,
              status: 'pending',
              internalNote: input.internalNote ?? null,
              createdByUserId: auth.userId,
            })
            .returning();
          if (!shipment) throw new ShipmentError('SHIPMENT_INSERT_FAILED', 'Could not create shipment');

          const items = await tx
            .insert(schema.shipmentItems)
            .values(
              lines.map((l) => ({
                tenantId,
                shipmentId: shipment.id,
                orderItemId: l.row.item.id,
                quantity: l.quantity,
                titleSnapshot: `${l.row.item.productTitleSnapshot} — ${l.row.item.variantTitleSnapshot}`,
                skuSnapshot: l.row.item.skuSnapshot,
              })),
            )
            .returning();

          await tx.insert(schema.shipmentEvents).values({
            tenantId,
            shipmentId: shipment.id,
            status: 'pending',
            description: 'Zásilka vytvořena',
            source: 'manual',
          });

          // First shipment moves the order into fulfilling (per `16`)
          if (order.status === 'paid') {
            await tx
              .update(schema.orders)
              .set({ status: 'fulfilling', statusEnteredAt: new Date(), updatedAt: new Date() })
              .where(eq(schema.orders.id, order.id));
          }

          return { shipment, items };
        });

        app.log.info(
          { shipmentId: result.shipment.id, orderId: order.id, number: result.shipment.number },
          'shipment.created',
        );
        return reply.code(201).send({ data: serializeShipment(result.shipment, result.items) });
      } catch (err) {
        if (err instanceof ShipmentError) {
          return reply.code(422).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/shipments/{pubId}/label — Packeta createPacket + label PDF
  // ---------------------------------------------------------------------------
  app.post<{ Params: { shipmentPubId: string } }>(
    '/api/2026-05-20/admin/shipments/:shipmentPubId/label',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const shipment = await findShipment(db, tenantId, req.params.shipmentPubId);
      if (!shipment) return notFound(reply, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
      if (!isValidShipmentTransition(shipment.status, 'label_generated')) {
        return reply.code(422).send({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Label requires status pending (current: ${shipment.status})`,
          },
        });
      }

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, shipment.orderId))
        .limit(1);
      if (!order) return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');

      // Home-delivery carrier id from provider config (real mode only)
      const [providerConfig] = await db
        .select({ options: schema.shippingProviderConfigs.options })
        .from(schema.shippingProviderConfigs)
        .where(
          and(
            eq(schema.shippingProviderConfigs.tenantId, tenantId),
            eq(schema.shippingProviderConfigs.carrierCode, shipment.carrierCode),
          ),
        )
        .limit(1);
      const providerOptions = (providerConfig?.options ?? {}) as {
        home_delivery_carrier_id?: string;
      };

      const pickup = shipment.pickupPointSnapshot as { external_id?: string; name?: string } | null;
      const address = shipment.shippingAddressSnapshot as {
        line1?: string;
        city?: string;
        postalCode?: string;
      };
      const recipient = splitRecipientName(order.customerName, order.customerEmail);

      try {
        const packet = await createPacket(config, {
          number: order.orderNumber,
          name: recipient.name,
          surname: recipient.surname,
          email: order.customerEmail,
          phone: order.customerPhone ?? undefined,
          valueMajor: Number(order.totalAmount) / 100,
          weightKg: Math.max(0.1, shipment.weightGrams / 1000),
          pickupPointExternalId: pickup?.external_id,
          homeDeliveryCarrierId: providerOptions.home_delivery_carrier_id,
          ...(address.line1 && address.city && address.postalCode
            ? { address: { street: address.line1, city: address.city, zip: address.postalCode } }
            : {}),
        });

        const destinationLine = pickup?.name
          ? `Výdejní místo: ${pickup.name}`
          : `${address.line1 ?? ''}, ${address.postalCode ?? ''} ${address.city ?? ''}`;
        const labelPdf = await getLabelPdf(config, packet, {
          orderNumber: order.orderNumber,
          recipientName: order.customerName ?? order.customerEmail,
          destinationLine,
        });

        const [updated] = await db
          .update(schema.shipments)
          .set({
            status: 'label_generated',
            statusEnteredAt: new Date(),
            carrierShipmentId: packet.carrierShipmentId,
            trackingNumber: packet.barcode,
            trackingUrl: trackingUrlFor(packet.barcode),
            labelPdfBase64: labelPdf.toString('base64'),
            labelGeneratedAt: new Date(),
            labelProvider: packet.provider,
            updatedAt: new Date(),
          })
          .where(eq(schema.shipments.id, shipment.id))
          .returning();

        await db.insert(schema.shipmentEvents).values({
          tenantId,
          shipmentId: shipment.id,
          status: 'label_generated',
          description: `Štítek vygenerován (${packet.provider === 'mock' ? 'mock' : 'Packeta'}), č. ${packet.barcode}`,
          source: 'system',
        });

        const items = await listShipmentItems(db, shipment.id);
        app.log.info(
          {
            shipmentId: shipment.id,
            provider: packet.provider,
            barcode: packet.barcode,
          },
          'shipment.label_generated',
        );
        return reply.send({ data: serializeShipment(updated!, items) });
      } catch (err) {
        app.log.error({ err, shipmentId: shipment.id }, 'shipment.label_failed');
        return reply.code(502).send({
          error: {
            code: 'CARRIER_ERROR',
            message: `Label generation failed: ${(err as Error).message}`,
          },
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /admin/shipments/{pubId}/label.pdf
  // ---------------------------------------------------------------------------
  app.get<{ Params: { shipmentPubId: string } }>(
    '/api/2026-05-20/admin/shipments/:shipmentPubId/label.pdf',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_VIEW)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const shipment = await findShipment(db, tenantId, req.params.shipmentPubId);
      if (!shipment || !shipment.labelPdfBase64) {
        return notFound(reply, 'LABEL_NOT_FOUND', 'Label not generated yet');
      }
      return reply
        .header('content-type', 'application/pdf')
        .header(
          'content-disposition',
          `attachment; filename="${shipment.number}-label.pdf"`,
        )
        .send(Buffer.from(shipment.labelPdfBase64, 'base64'));
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/shipments/{pubId}/handed-over — fulfillment commit
  // ---------------------------------------------------------------------------
  app.post<{ Params: { shipmentPubId: string } }>(
    '/api/2026-05-20/admin/shipments/:shipmentPubId/handed-over',
    { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const shipment = await findShipment(db, tenantId, req.params.shipmentPubId);
      if (!shipment) return notFound(reply, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
      if (!isValidShipmentTransition(shipment.status, 'handed_over')) {
        return reply.code(422).send({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Handover requires a generated label (current: ${shipment.status})`,
          },
        });
      }

      const items = await listShipmentItems(db, shipment.id);

      const orderAfter = await db.transaction(async (tx) => {
        await tx
          .update(schema.shipments)
          .set({
            status: 'handed_over',
            statusEnteredAt: new Date(),
            handedOverAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.shipments.id, shipment.id));

        await tx.insert(schema.shipmentEvents).values({
          tenantId,
          shipmentId: shipment.id,
          status: 'handed_over',
          description: 'Zásilka předána dopravci',
          source: 'manual',
        });

        // Fulfillment commit per line
        for (const it of items) {
          await tx
            .update(schema.orderItems)
            .set({
              quantityFulfilled: dsql`${schema.orderItems.quantityFulfilled} + ${it.quantity}`,
            })
            .where(eq(schema.orderItems.id, it.orderItemId));
        }

        // Recompute order fulfillment status
        const lines = await tx
          .select({
            quantity: schema.orderItems.quantity,
            fulfilled: schema.orderItems.quantityFulfilled,
          })
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, shipment.orderId));
        const allFulfilled = lines.every((l) => l.fulfilled >= l.quantity);

        const [order] = await tx
          .update(schema.orders)
          .set({
            ...(allFulfilled
              ? {
                  status: 'fulfilled' as const,
                  statusEnteredAt: new Date(),
                  fulfilledAt: new Date(),
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, shipment.orderId))
          .returning();
        return order!;
      });

      // Shipped notification (best-effort)
      void (async () => {
        try {
          const [tenant] = await db
            .select({ slug: schema.tenants.slug, displayName: schema.tenants.displayName })
            .from(schema.tenants)
            .where(eq(schema.tenants.id, tenantId))
            .limit(1);
          if (!tenant) return;
          const pickup = shipment.pickupPointSnapshot as { name?: string } | null;
          const { subject, text, html } = renderOrderShippedEmail({
            tenantName: tenant.displayName,
            tenantSlug: tenant.slug,
            storefrontBaseUrl: config.SHOPIO_BASE_URL,
            orderNumber: orderAfter.orderNumber,
            customerName: orderAfter.customerName,
            customerEmail: orderAfter.customerEmail,
            carrierName: shipment.carrierCode === 'zasilkovna' ? 'Zásilkovna' : shipment.carrierCode,
            trackingNumber: shipment.trackingNumber,
            trackingUrl: shipment.trackingUrl,
            pickupPointName: pickup?.name ?? null,
          });
          await sendEmail(config, { to: orderAfter.customerEmail, subject, text, html });
          app.log.info({ shipmentId: shipment.id }, 'shipment.shipped_email_sent');
        } catch (err) {
          app.log.error({ err, shipmentId: shipment.id }, 'shipment.shipped_email_failed');
        }
      })();

      const [updated] = await db
        .select()
        .from(schema.shipments)
        .where(eq(schema.shipments.id, shipment.id))
        .limit(1);
      app.log.info({ shipmentId: shipment.id, orderStatus: orderAfter.status }, 'shipment.handed_over');
      return reply.send({
        data: { ...serializeShipment(updated!, items), order_status: orderAfter.status },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /admin/shipments/{pubId}/delivered | /cancel
  // ---------------------------------------------------------------------------
  for (const [action, target, description] of [
    ['delivered', 'delivered', 'Zásilka doručena'],
    ['cancel', 'cancelled', 'Zásilka zrušena'],
  ] as const) {
    app.post<{ Params: { shipmentPubId: string } }>(
      `/api/2026-05-20/admin/shipments/:shipmentPubId/${action}`,
      { preHandler: [requirePermission(PERMISSIONS.ORDER_EDIT)] },
      async (req, reply) => {
        const tenantId = req.auth!.tenantId;
        if (!tenantId) return noTenant(reply);

        const shipment = await findShipment(db, tenantId, req.params.shipmentPubId);
        if (!shipment) return notFound(reply, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
        if (!isValidShipmentTransition(shipment.status, target)) {
          return reply.code(422).send({
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition from ${shipment.status} → ${target}`,
            },
          });
        }

        const [updated] = await db
          .update(schema.shipments)
          .set({
            status: target,
            statusEnteredAt: new Date(),
            ...(target === 'delivered' && { deliveredAt: new Date() }),
            ...(target === 'cancelled' && { cancelledAt: new Date() }),
            updatedAt: new Date(),
          })
          .where(eq(schema.shipments.id, shipment.id))
          .returning();

        await db.insert(schema.shipmentEvents).values({
          tenantId,
          shipmentId: shipment.id,
          status: target,
          description,
          source: 'manual',
        });

        const items = await listShipmentItems(db, shipment.id);
        app.log.info({ shipmentId: shipment.id, to: target }, 'shipment.status_updated');
        return reply.send({ data: serializeShipment(updated!, items) });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/orders/{orderNumber}/tracking
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { tenantSlug: string; orderNumber: string };
    Querystring: { email?: string };
  }>(
    '/api/2026-05-20/storefront/:tenantSlug/orders/:orderNumber/tracking',
    async (req, reply) => {
      const [tenant] = await db
        .select({ id: schema.tenants.id, status: schema.tenants.status })
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, req.params.tenantSlug))
        .limit(1);
      if (!tenant || tenant.status !== 'active') {
        return notFound(reply, 'TENANT_NOT_FOUND', 'tenant not found');
      }
      const [order] = await db
        .select({ id: schema.orders.id, customerEmail: schema.orders.customerEmail })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenant.id),
            eq(schema.orders.orderNumber, req.params.orderNumber),
          ),
        )
        .limit(1);
      const providedEmail = req.query.email?.toLowerCase();
      if (!order || !providedEmail || providedEmail !== order.customerEmail.toLowerCase()) {
        return notFound(reply, 'ORDER_NOT_FOUND', 'Order not found');
      }

      const rows = await db
        .select()
        .from(schema.shipments)
        .where(eq(schema.shipments.orderId, order.id))
        .orderBy(asc(schema.shipments.createdAt));
      const events = rows.length
        ? await db
            .select()
            .from(schema.shipmentEvents)
            .where(
              and(
                inArray(
                  schema.shipmentEvents.shipmentId,
                  rows.map((r) => r.id),
                ),
                eq(schema.shipmentEvents.isCustomerVisible, true),
              ),
            )
            .orderBy(asc(schema.shipmentEvents.occurredAt))
        : [];

      return reply.send({
        data: {
          shipments: rows
            .filter((r) => r.status !== 'cancelled')
            .map((r) => ({
              number: r.number,
              carrier: r.carrierCode,
              status: r.status,
              tracking_number: r.trackingNumber,
              tracking_url: r.trackingUrl,
              handed_over_at: r.handedOverAt,
              delivered_at: r.deliveredAt,
              events: events
                .filter((e) => e.shipmentId === r.id)
                .map((e) => ({
                  status: e.status,
                  description: e.description,
                  occurred_at: e.occurredAt,
                })),
            })),
        },
      });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

async function findOrderByPubId(db: AppDb, tenantId: string, orderPubId: string) {
  const [order] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.pubId, orderPubId)))
    .limit(1);
  return order ?? null;
}

async function findShipment(db: AppDb, tenantId: string, shipmentPubId: string) {
  const [s] = await db
    .select()
    .from(schema.shipments)
    .where(and(eq(schema.shipments.tenantId, tenantId), eq(schema.shipments.pubId, shipmentPubId)))
    .limit(1);
  return s ?? null;
}

async function listShipmentItems(db: AppDb, shipmentId: string) {
  return db
    .select()
    .from(schema.shipmentItems)
    .where(eq(schema.shipmentItems.shipmentId, shipmentId))
    .orderBy(asc(schema.shipmentItems.createdAt));
}

function serializeShipment(
  s: typeof schema.shipments.$inferSelect,
  items: (typeof schema.shipmentItems.$inferSelect)[],
) {
  return {
    id: s.pubId,
    number: s.number,
    status: s.status,
    carrier_code: s.carrierCode,
    service_code: s.serviceCode,
    weight_grams: s.weightGrams,
    tracking_number: s.trackingNumber,
    tracking_url: s.trackingUrl,
    label_provider: s.labelProvider,
    has_label: Boolean(s.labelPdfBase64),
    pickup_point: s.pickupPointSnapshot,
    internal_note: s.internalNote,
    created_at: s.createdAt,
    label_generated_at: s.labelGeneratedAt,
    handed_over_at: s.handedOverAt,
    delivered_at: s.deliveredAt,
    cancelled_at: s.cancelledAt,
    items: items.map((i) => ({
      id: i.id,
      title: i.titleSnapshot,
      sku: i.skuSnapshot,
      quantity: i.quantity,
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
