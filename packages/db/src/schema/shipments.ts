/**
 * `shipments` + `shipment_items` + `shipment_events` — per `14-shipping.md`
 * §3.1 (ENT-SHIPMENT-001) + `16-order-management.md` fulfillment, MVP subset.
 *
 * Fulfillment slice: admin creates a shipment from order items, generates a
 * Zásilkovna/Packeta label (mock fallback without credentials), marks
 * handover, and the order's fulfillment state derives from per-line
 * `order_items.quantity_fulfilled` (RULE-SHIP-006).
 *
 * State machine (MVP): pending → label_generated → handed_over → delivered;
 * cancellable until handed_over (RULE-SHIP-030).
 *
 * Deferred: carrier webhooks/polling, COD, insurance, multi-warehouse,
 * customs, return labels, bulk label generation.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orderItems, orders } from './orders';
import { tenants } from './tenants';

export const SHIPMENT_STATUSES = [
  'pending',
  'label_generated',
  'handed_over',
  'delivered',
  'cancelled',
] as const;

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // shp_ NanoID
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /** Per-tenant sequential — e.g. SHP-2026-0001. */
    number: text('number').notNull(),
    carrierCode: text('carrier_code').notNull(), // 'zasilkovna', ...
    serviceCode: text('service_code').notNull(), // 'pickup_point' | 'home_delivery'
    /** Destination snapshots frozen from the order. */
    shippingAddressSnapshot: jsonb('shipping_address_snapshot').notNull(),
    pickupPointSnapshot: jsonb('pickup_point_snapshot'),
    weightGrams: integer('weight_grams').notNull().default(0),
    status: text('status', { enum: SHIPMENT_STATUSES }).notNull().default('pending'),
    statusEnteredAt: timestamp('status_entered_at', { withTimezone: true }).notNull().defaultNow(),
    // Carrier-side (populated by label generation)
    carrierShipmentId: text('carrier_shipment_id'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    /** Label PDF (base64) — carrier-issued artifacts can't be regenerated, so
     * they're stored; object storage replaces this in the MinIO wave. */
    labelPdfBase64: text('label_pdf_base64'),
    labelGeneratedAt: timestamp('label_generated_at', { withTimezone: true }),
    /** 'packeta' (real API) | 'mock' (no PACKETA_API_PASSWORD configured). */
    labelProvider: text('label_provider'),
    // Lifecycle
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    internalNote: text('internal_note'),
    // Audit
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_shipments_pub_id').on(t.tenantId, t.pubId),
    numberUnique: uniqueIndex('uq_shipments_number').on(t.tenantId, t.number),
    /** RULE-SHIP-015: tracking number unique per tenant+carrier. */
    trackingUnique: uniqueIndex('uq_shipments_tracking')
      .on(t.tenantId, t.carrierCode, t.trackingNumber)
      .where(sql`tracking_number IS NOT NULL`),
    orderIdx: index('idx_shipments_order').on(t.orderId),
    tenantStatusIdx: index('idx_shipments_tenant_status').on(t.tenantId, t.status, t.createdAt),
  }),
);

export const shipmentItems = pgTable(
  'shipment_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    titleSnapshot: text('title_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shipmentItemUnique: uniqueIndex('uq_shipment_items').on(t.shipmentId, t.orderItemId),
    shipmentIdx: index('idx_shipment_items_shipment').on(t.shipmentId),
    orderItemIdx: index('idx_shipment_items_order_item').on(t.orderItemId),
  }),
);

/** Append-only status history (customer-visible timeline + audit). */
export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    description: text('description'),
    source: text('source', { enum: ['manual', 'system', 'webhook'] })
      .notNull()
      .default('manual'),
    isCustomerVisible: boolean('is_customer_visible').notNull().default(true),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb('raw'),
  },
  (t) => ({
    shipmentIdx: index('idx_shipment_events_shipment').on(t.shipmentId, t.occurredAt),
  }),
);

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
