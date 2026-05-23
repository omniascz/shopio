/**
 * Shipping — zones, rates, pickup points, provider configs.
 * Per `14-shipping.md` §3.4–3.7.
 *
 * Wave 1 MVP boundary: storefront-facing rating + pickup-point selection only.
 * Shipments / labels / tracking / webhooks (the fulfillment side) land in Wave 2,
 * along with live rates, box-packing, ETA-from-warehouse, and PostGIS geo search.
 * Columns here are a pragmatic subset of the full spec.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/** Geographic groups for rate rules — typically countries. */
export const shippingZones = pgTable(
  'shipping_zones',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "CZ", "EU", "Mimo EU"
    /** ISO 3166-1 alpha-2 codes this zone covers. */
    countryCodes: text('country_codes').array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(0), // higher matches first
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameUnique: uniqueIndex('uq_shipping_zones_tenant_name').on(t.tenantId, t.name),
    activeIdx: index('idx_shipping_zones_active')
      .on(t.tenantId, t.priority)
      .where(sql`is_active = true`),
  }),
);

/** A purchasable shipping method within a zone. */
export const shippingRates = pgTable(
  'shipping_rates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shippingZoneId: uuid('shipping_zone_id')
      .notNull()
      .references(() => shippingZones.id, { onDelete: 'cascade' }),
    carrierCode: text('carrier_code').notNull(), // 'zasilkovna', 'ppl', ...
    serviceCode: text('service_code').notNull(), // normalized: 'pickup_point' | 'home_delivery' | ...
    displayName: text('display_name').notNull(), // "Zásilkovna — výdejní místo"
    description: text('description'),
    /** Rate calculation strategy. */
    kind: text('kind', {
      enum: ['flat', 'weight_based', 'price_based', 'free_above_threshold'],
    }).notNull(),
    amount: bigint('amount', { mode: 'bigint' }), // flat / fallback amount (minor units)
    currency: text('currency').notNull(),
    /** Tiers for weight_based / price_based:
     * [{ max_weight_grams, amount }] or [{ max_subtotal, amount }]. */
    tiers: jsonb('tiers'),
    /** For free_above_threshold: free when cart subtotal ≥ this. */
    freeAboveAmount: bigint('free_above_amount', { mode: 'bigint' }),
    /** True for pickup_point services that require a selected point. */
    pickupOnly: boolean('pickup_only').notNull().default(false),
    supportsCod: boolean('supports_cod').notNull().default(false),
    estimatedDaysMin: integer('estimated_days_min'),
    estimatedDaysMax: integer('estimated_days_max'),
    /** Cart-weight constraints (grams). */
    minWeightGrams: integer('min_weight_grams'),
    maxWeightGrams: integer('max_weight_grams'),
    isActive: boolean('is_active').notNull().default(true),
    isVisibleInCheckout: boolean('is_visible_in_checkout').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    unique: uniqueIndex('uq_shipping_rates_unique').on(
      t.shippingZoneId,
      t.carrierCode,
      t.serviceCode,
    ),
    zoneIdx: index('idx_shipping_rates_zone')
      .on(t.shippingZoneId)
      .where(sql`is_active = true`),
    carrierIdx: index('idx_shipping_rates_tenant_carrier').on(
      t.tenantId,
      t.carrierCode,
      t.isActive,
    ),
  }),
);

/**
 * Carrier pickup-point cache (Zásilkovna výdejny / Z-BOX, ČP Balíkovny).
 * Platform-wide — no tenant_id (carrier-owned shared data).
 */
export const pickupPoints = pgTable(
  'pickup_points',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    carrierCode: text('carrier_code').notNull(),
    externalId: text('external_id').notNull(), // carrier's own point ID
    name: text('name').notNull(),
    street: text('street'),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    countryCode: text('country_code').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    openingHours: jsonb('opening_hours'),
    isActive: boolean('is_active').notNull().default(true),
    supportsCod: boolean('supports_cod').notNull().default(true),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    syncSource: text('sync_source'), // 'api' | 'csv_feed' | 'manual'
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    carrierExternalUnique: uniqueIndex('uq_pickup_points_carrier_external').on(
      t.carrierCode,
      t.externalId,
    ),
    countryPostalIdx: index('idx_pickup_points_country_postal')
      .on(t.countryCode, t.postalCode)
      .where(sql`is_active = true`),
    carrierIdx: index('idx_pickup_points_active_carrier')
      .on(t.carrierCode)
      .where(sql`is_active = true`),
  }),
);

/** Per-tenant carrier credentials + settings. */
export const shippingProviderConfigs = pgTable(
  'shipping_provider_configs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    carrierCode: text('carrier_code').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    isTestMode: boolean('is_test_mode').notNull().default(true),
    displayName: text('display_name').notNull(),
    /** Reference to the credential in the secrets store (real key never in DB). */
    credentialsVaultPath: text('credentials_vault_path'),
    senderAddressSnapshot: jsonb('sender_address_snapshot'),
    options: jsonb('options')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('uq_shipping_provider_configs').on(t.tenantId, t.carrierCode),
    enabledIdx: index('idx_shipping_provider_configs_enabled')
      .on(t.tenantId)
      .where(sql`is_enabled = true`),
  }),
);

export type ShippingZone = typeof shippingZones.$inferSelect;
export type NewShippingZone = typeof shippingZones.$inferInsert;
export type ShippingRate = typeof shippingRates.$inferSelect;
export type NewShippingRate = typeof shippingRates.$inferInsert;
export type PickupPoint = typeof pickupPoints.$inferSelect;
export type NewPickupPoint = typeof pickupPoints.$inferInsert;
export type ShippingProviderConfig = typeof shippingProviderConfigs.$inferSelect;
export type NewShippingProviderConfig = typeof shippingProviderConfigs.$inferInsert;
