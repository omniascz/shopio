/**
 * Resolve shipping zone + rates from the DB and price them for a cart.
 * Per `14-shipping.md` §5 STAGE 1-4 (MVP subset).
 */

import { and, asc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';
import {
  calculateShippingOptions,
  type CartShippingMetrics,
  type ShippingOption,
  type ShippingRateRow,
} from './shipping';

/** Resolve the highest-priority active zone covering the country. */
async function resolveZone(db: AppDb, tenantId: string, countryCode: string) {
  const [zone] = await db
    .select({ id: schema.shippingZones.id, name: schema.shippingZones.name })
    .from(schema.shippingZones)
    .where(
      and(
        eq(schema.shippingZones.tenantId, tenantId),
        eq(schema.shippingZones.isActive, true),
        dsql`${countryCode.toUpperCase()} = ANY(${schema.shippingZones.countryCodes})`,
      ),
    )
    .orderBy(dsql`${schema.shippingZones.priority} DESC`)
    .limit(1);
  return zone ?? null;
}

async function loadRates(db: AppDb, zoneId: string): Promise<ShippingRateRow[]> {
  return db
    .select({
      id: schema.shippingRates.id,
      carrierCode: schema.shippingRates.carrierCode,
      serviceCode: schema.shippingRates.serviceCode,
      displayName: schema.shippingRates.displayName,
      description: schema.shippingRates.description,
      kind: schema.shippingRates.kind,
      amount: schema.shippingRates.amount,
      currency: schema.shippingRates.currency,
      tiers: schema.shippingRates.tiers,
      freeAboveAmount: schema.shippingRates.freeAboveAmount,
      pickupOnly: schema.shippingRates.pickupOnly,
      supportsCod: schema.shippingRates.supportsCod,
      estimatedDaysMin: schema.shippingRates.estimatedDaysMin,
      estimatedDaysMax: schema.shippingRates.estimatedDaysMax,
      minWeightGrams: schema.shippingRates.minWeightGrams,
      maxWeightGrams: schema.shippingRates.maxWeightGrams,
      priority: schema.shippingRates.priority,
    })
    .from(schema.shippingRates)
    .where(
      and(
        eq(schema.shippingRates.shippingZoneId, zoneId),
        eq(schema.shippingRates.isActive, true),
        eq(schema.shippingRates.isVisibleInCheckout, true),
      ),
    );
}

/**
 * Resolve priced shipping options for a cart shipping to `countryCode`.
 * Returns [] when no zone covers the country (caller decides how to surface).
 */
export async function resolveShippingOptions(
  db: AppDb,
  tenantId: string,
  countryCode: string,
  metrics: CartShippingMetrics,
): Promise<ShippingOption[]> {
  const zone = await resolveZone(db, tenantId, countryCode);
  if (!zone) return [];
  const rates = await loadRates(db, zone.id);
  return calculateShippingOptions(rates as ShippingRateRow[], metrics);
}

/** Look up one priced option by rate id (for checkout validation). */
export async function resolveOptionById(
  db: AppDb,
  tenantId: string,
  countryCode: string,
  rateId: string,
  metrics: CartShippingMetrics,
): Promise<ShippingOption | null> {
  const options = await resolveShippingOptions(db, tenantId, countryCode, metrics);
  return options.find((o) => o.rate_id === rateId) ?? null;
}

export interface PickupPointResult {
  external_id: string;
  name: string;
  street: string | null;
  city: string;
  postal_code: string;
  country_code: string;
}

/** Search the cached pickup points (fallback picker when no carrier widget). */
export async function searchPickupPoints(
  db: AppDb,
  carrierCode: string,
  countryCode: string,
  query: string | undefined,
  limit = 20,
): Promise<PickupPointResult[]> {
  const q = (query ?? '').trim().toLowerCase();
  const rows = await db
    .select({
      external_id: schema.pickupPoints.externalId,
      name: schema.pickupPoints.name,
      street: schema.pickupPoints.street,
      city: schema.pickupPoints.city,
      postal_code: schema.pickupPoints.postalCode,
      country_code: schema.pickupPoints.countryCode,
    })
    .from(schema.pickupPoints)
    .where(
      and(
        eq(schema.pickupPoints.carrierCode, carrierCode),
        eq(schema.pickupPoints.countryCode, countryCode.toUpperCase()),
        eq(schema.pickupPoints.isActive, true),
        q
          ? dsql`(lower(${schema.pickupPoints.name}) LIKE ${'%' + q + '%'} OR lower(${schema.pickupPoints.city}) LIKE ${'%' + q + '%'} OR ${schema.pickupPoints.postalCode} LIKE ${'%' + q + '%'})`
          : dsql`true`,
      ),
    )
    .orderBy(asc(schema.pickupPoints.city), asc(schema.pickupPoints.name))
    .limit(limit);
  return rows;
}

/** Resolve a single pickup point snapshot by carrier + external id (checkout). */
export async function getPickupPoint(
  db: AppDb,
  carrierCode: string,
  externalId: string,
): Promise<PickupPointResult | null> {
  const [row] = await db
    .select({
      external_id: schema.pickupPoints.externalId,
      name: schema.pickupPoints.name,
      street: schema.pickupPoints.street,
      city: schema.pickupPoints.city,
      postal_code: schema.pickupPoints.postalCode,
      country_code: schema.pickupPoints.countryCode,
    })
    .from(schema.pickupPoints)
    .where(
      and(
        eq(schema.pickupPoints.carrierCode, carrierCode),
        eq(schema.pickupPoints.externalId, externalId),
        eq(schema.pickupPoints.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}
