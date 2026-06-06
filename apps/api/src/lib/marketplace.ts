/**
 * Marketplace helpers (per `25-marketplace.md` MVP) — payment-independent.
 *
 * Commission is recorded at order placement: for each sold line whose product
 * belongs to an active vendor, insert one `marketplace_commissions` row with
 * the platform cut + vendor earning. Pure arithmetic — no money movement,
 * balances, or payouts (deferred).
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';

/** commission = floor(net × bps / 10000); vendorEarning = net − commission. */
export function computeCommission(
  lineNet: bigint,
  basisPoints: number,
): { commission: bigint; vendorEarning: bigint } {
  const commission = (lineNet * BigInt(basisPoints)) / 10000n;
  return { commission, vendorEarning: lineNet - commission };
}

export type Vendor = typeof schema.vendors.$inferSelect;

export function serializeVendor(v: Vendor) {
  return {
    id: v.pubId,
    slug: v.slug,
    display_name: v.displayName,
    legal_entity_name: v.legalEntityName,
    registration_number: v.registrationNumber,
    vat_id: v.vatId,
    contact_email: v.contactEmail,
    contact_phone: v.contactPhone,
    status: v.status,
    commission_basis_points: v.commissionBasisPoints,
    created_at: v.createdAt,
  };
}

/**
 * Record commission rows for an order's vendor-owned lines. MUST run inside the
 * order-placement transaction (RLS-scoped). Idempotent per order line.
 */
export async function recordCommissions(
  tx: TenantTx,
  tenantId: string,
  orderId: string,
): Promise<void> {
  // Lines whose product belongs to an active vendor.
  const lines = await tx
    .select({
      orderItemId: schema.orderItems.id,
      lineSubtotal: schema.orderItems.lineSubtotalAmount,
      currency: schema.orderItems.unitPriceCurrency,
      vendorId: schema.products.vendorId,
      bps: schema.vendors.commissionBasisPoints,
      vendorStatus: schema.vendors.status,
    })
    .from(schema.orderItems)
    .innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
    .innerJoin(schema.vendors, eq(schema.vendors.id, schema.products.vendorId))
    .where(
      and(
        eq(schema.orderItems.orderId, orderId),
        isNotNull(schema.products.vendorId),
        eq(schema.vendors.status, 'active'),
      ),
    );

  if (lines.length === 0) return;

  const rows = lines.map((l) => {
    const { commission, vendorEarning } = computeCommission(l.lineSubtotal, l.bps);
    return {
      tenantId,
      vendorId: l.vendorId!,
      orderId,
      orderItemId: l.orderItemId,
      currency: l.currency,
      lineSubtotalAmount: l.lineSubtotal,
      commissionBasisPoints: l.bps,
      commissionAmount: commission,
      vendorEarningAmount: vendorEarning,
    };
  });

  await tx.insert(schema.marketplaceCommissions).values(rows).onConflictDoNothing({
    target: schema.marketplaceCommissions.orderItemId,
  });
}
