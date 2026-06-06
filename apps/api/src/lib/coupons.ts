/**
 * Coupon validation + discount math — per `10-pricing-promotions.md` MVP.
 *
 * Pure functions for the discount arithmetic (unit-tested) + a DB-backed
 * validator. The checkout calls `validateCoupon` (read-only, pre-flight),
 * applies the discount to the taxable base, then records the redemption
 * atomically inside the placement transaction.
 *
 * VAT (EU rule): a discount lowers the selling price, hence the tax base. The
 * goods discount is distributed across taxable lines proportionally and
 * subtracted BEFORE the gross-inclusive VAT extraction.
 */

import { and, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';

type DbConn = AppDb | Parameters<Parameters<AppDb['transaction']>[0]>[0];

export class CouponError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface DiscountResult {
  /** Discount on goods (gross, minor units). */
  goodsDiscount: bigint;
  /** Discount on shipping (free_shipping coupons); shipping charge waived. */
  shippingDiscount: bigint;
}

/**
 * Compute the discount a coupon yields for a cart. Pure. Never returns more
 * than the amounts available (no negative totals, RULE-PRICING-017).
 */
export function computeDiscount(
  coupon: Pick<
    typeof schema.coupons.$inferSelect,
    'kind' | 'value' | 'maxDiscountAmount'
  >,
  cart: { goodsGross: bigint; shippingGross: bigint },
): DiscountResult {
  let goods = 0n;
  let shipping = 0n;
  switch (coupon.kind) {
    case 'percentage':
      goods = (cart.goodsGross * coupon.value) / 10000n; // value = basis points
      break;
    case 'fixed':
      goods = coupon.value;
      break;
    case 'free_shipping':
      shipping = cart.shippingGross;
      break;
  }
  if (coupon.maxDiscountAmount != null && goods > coupon.maxDiscountAmount) {
    goods = coupon.maxDiscountAmount;
  }
  // Clamp to available amounts
  if (goods > cart.goodsGross) goods = cart.goodsGross;
  if (goods < 0n) goods = 0n;
  if (shipping > cart.shippingGross) shipping = cart.shippingGross;
  return { goodsDiscount: goods, shippingDiscount: shipping };
}

/**
 * Distribute a goods discount across lines proportionally to each line's
 * gross, flooring per line and assigning the rounding remainder to the last
 * line — so Σ line discounts == total discount exactly (no penny drift into
 * the VAT base).
 */
export function distributeDiscount(
  lineGrosses: bigint[],
  totalDiscount: bigint,
): bigint[] {
  const sum = lineGrosses.reduce((a, b) => a + b, 0n);
  if (sum <= 0n || totalDiscount <= 0n) return lineGrosses.map(() => 0n);
  const out = lineGrosses.map((g) => (g * totalDiscount) / sum); // floor
  const assigned = out.reduce((a, b) => a + b, 0n);
  let remainder = totalDiscount - assigned;
  // hand the remainder to lines with the largest gross first
  const order = lineGrosses
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (b.g > a.g ? 1 : b.g < a.g ? -1 : 0));
  for (const { i } of order) {
    if (remainder <= 0n) break;
    if (out[i]! < lineGrosses[i]!) {
      out[i] = out[i]! + 1n;
      remainder -= 1n;
    }
  }
  return out;
}

export interface ValidatedCoupon {
  coupon: typeof schema.coupons.$inferSelect;
}

/**
 * Validate a coupon for a cart (read-only). Throws CouponError on any failure
 * so the caller maps it to a 422 with a stable code.
 */
export async function validateCoupon(
  db: DbConn,
  params: {
    tenantId: string;
    code: string;
    goodsGross: bigint;
    customerId?: string | null;
    now?: Date;
  },
): Promise<ValidatedCoupon> {
  const now = params.now ?? new Date();
  const code = params.code.trim().toUpperCase();
  if (!code) throw new CouponError('COUPON_EMPTY', 'Zadejte slevový kód');

  const [coupon] = await db
    .select()
    .from(schema.coupons)
    .where(
      and(eq(schema.coupons.tenantId, params.tenantId), eq(schema.coupons.code, code)),
    )
    .limit(1);

  if (!coupon || !coupon.isActive) {
    throw new CouponError('COUPON_NOT_FOUND', 'Slevový kód neexistuje nebo není aktivní');
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new CouponError('COUPON_NOT_YET_VALID', 'Slevový kód zatím neplatí');
  }
  if (coupon.endsAt && coupon.endsAt <= now) {
    throw new CouponError('COUPON_EXPIRED', 'Platnost slevového kódu vypršela');
  }
  if (coupon.minPurchaseAmount > 0n && params.goodsGross < coupon.minPurchaseAmount) {
    throw new CouponError(
      'COUPON_MIN_PURCHASE',
      `Kód platí od objednávky ${(Number(coupon.minPurchaseAmount) / 100).toFixed(0)} ${coupon.currency ?? ''}`,
    );
  }
  if (coupon.maxUsesTotal != null && coupon.usageCount >= coupon.maxUsesTotal) {
    throw new CouponError('COUPON_EXHAUSTED', 'Slevový kód byl už vyčerpán');
  }
  if (coupon.maxUsesPerCustomer != null && params.customerId) {
    const [used] = await db
      .select({ count: dsql<number>`COUNT(*)::int` })
      .from(schema.couponRedemptions)
      .where(
        and(
          eq(schema.couponRedemptions.couponId, coupon.id),
          eq(schema.couponRedemptions.customerId, params.customerId),
        ),
      );
    if ((used?.count ?? 0) >= coupon.maxUsesPerCustomer) {
      throw new CouponError('COUPON_PER_CUSTOMER_LIMIT', 'Tento kód jste už využili');
    }
  }

  return { coupon };
}
