/**
 * Automatic promotion engine (per `10-pricing-promotions.md`, Magento-style
 * cart rules). Pure evaluation: (active rules × cart) → discount, in the same
 * {goodsDiscount, shippingDiscount} shape as the coupon engine so checkout can
 * combine them.
 *
 * Ratio-based kinds (order_percentage / free_shipping / bogo) are currency
 * agnostic; order_fixed carries a base-currency amount (the caller filters it
 * out for a non-base charge currency).
 */

import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;
type Promotion = typeof schema.promotions.$inferSelect;

export interface PromoCartLine {
  unitPrice: bigint;
  quantity: number;
}

export interface PromoCart {
  goodsGross: bigint;
  shippingGross: bigint;
  lines: PromoCartLine[];
}

export interface AppliedPromotion {
  pubId: string;
  name: string;
  kind: string;
  goodsDiscount: bigint;
  shippingDiscount: bigint;
}

export interface PromotionResult {
  goodsDiscount: bigint;
  shippingDiscount: bigint;
  applied: AppliedPromotion[];
}

/** Active promotions in the validity window, highest priority first. */
export async function loadActivePromotions(
  db: Db,
  tenantId: string,
  now: Date,
): Promise<Promotion[]> {
  const rows = await db
    .select()
    .from(schema.promotions)
    .where(and(eq(schema.promotions.tenantId, tenantId), eq(schema.promotions.isActive, true)))
    .orderBy(desc(schema.promotions.priority));
  return rows.filter(
    (p) =>
      (!p.startsAt || p.startsAt.getTime() <= now.getTime()) &&
      (!p.endsAt || p.endsAt.getTime() > now.getTime()),
  );
}

/** Does the cart meet a promotion's conditions (subtotal + quantity)? */
function matches(promo: Promotion, cart: PromoCart, totalQty: number): boolean {
  if (cart.goodsGross < promo.minSubtotal) return false;
  if (totalQty < promo.minQuantity) return false;
  if (promo.kind === 'bogo' && totalQty < promo.buyQuantity + promo.getQuantity) return false;
  return true;
}

/** The discount a single promotion yields for the cart (clamped to available). */
function discountFor(promo: Promotion, cart: PromoCart): { goods: bigint; shipping: bigint } {
  let goods = 0n;
  let shipping = 0n;
  switch (promo.kind) {
    case 'order_percentage':
      goods = (cart.goodsGross * promo.value) / 10000n;
      break;
    case 'order_fixed':
      goods = promo.value;
      break;
    case 'free_shipping':
      shipping = cart.shippingGross;
      break;
    case 'bogo': {
      const group = promo.buyQuantity + promo.getQuantity;
      if (group <= 0) break;
      // Expand to per-unit prices, cheapest first; the cheapest `groups × get`
      // units are discounted.
      const units: bigint[] = [];
      for (const l of cart.lines) for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice);
      units.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const groups = Math.floor(units.length / group);
      const discounted = groups * promo.getQuantity;
      let sum = 0n;
      for (let i = 0; i < discounted && i < units.length; i++) sum += units[i]!;
      goods = (sum * BigInt(promo.getDiscountBps)) / 10000n;
      break;
    }
  }
  if (promo.maxDiscountAmount != null && goods > promo.maxDiscountAmount) goods = promo.maxDiscountAmount;
  if (goods > cart.goodsGross) goods = cart.goodsGross;
  if (goods < 0n) goods = 0n;
  if (shipping > cart.shippingGross) shipping = cart.shippingGross;
  return { goods, shipping };
}

/**
 * Evaluate promotions against a cart. Stackable rules sum; if any matching rule
 * is non-stackable the single highest-value matching rule applies exclusively
 * (Magento "discard subsequent rules"). Totals are clamped to the cart.
 */
export function evaluatePromotions(promos: Promotion[], cart: PromoCart): PromotionResult {
  const totalQty = cart.lines.reduce((s, l) => s + l.quantity, 0);
  const candidates: AppliedPromotion[] = [];
  for (const p of promos) {
    if (!matches(p, cart, totalQty)) continue;
    const d = discountFor(p, cart);
    if (d.goods === 0n && d.shipping === 0n) continue;
    candidates.push({
      pubId: p.pubId,
      name: p.name,
      kind: p.kind,
      goodsDiscount: d.goods,
      shippingDiscount: d.shipping,
    });
  }
  if (candidates.length === 0) return { goodsDiscount: 0n, shippingDiscount: 0n, applied: [] };

  const anyNonStackable = promos.some(
    (p) => !p.stackable && candidates.find((c) => c.pubId === p.pubId),
  );
  let applied: AppliedPromotion[];
  if (anyNonStackable) {
    // Pick the single best by total value.
    applied = [
      candidates.reduce((best, c) =>
        c.goodsDiscount + c.shippingDiscount > best.goodsDiscount + best.shippingDiscount ? c : best,
      ),
    ];
  } else {
    applied = candidates;
  }

  let goods = applied.reduce((s, c) => s + c.goodsDiscount, 0n);
  let shipping = applied.reduce((s, c) => s + c.shippingDiscount, 0n);
  if (goods > cart.goodsGross) goods = cart.goodsGross;
  if (shipping > cart.shippingGross) shipping = cart.shippingGross;
  return { goodsDiscount: goods, shippingDiscount: shipping, applied };
}
