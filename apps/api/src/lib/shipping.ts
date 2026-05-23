/**
 * Shipping rate calculator — per `14-shipping.md` §5 (simplified MVP pipeline).
 *
 * Pure function: (rates × cart metrics) → priced, sorted options. Zone resolution
 * + rate loading is the caller's job (DB). No live-rate carrier calls, no
 * box-packing, no ETA-from-warehouse yet (Wave 2).
 *
 * Money is BigInt minor units. Weight is grams.
 */

export type ShippingRateKind = 'flat' | 'weight_based' | 'price_based' | 'free_above_threshold';

export interface ShippingTier {
  /** Upper bound for this tier (inclusive). Use one of the two per `kind`. */
  max_weight_grams?: number;
  max_subtotal?: number | string;
  amount: number | string;
}

export interface ShippingRateRow {
  id: string;
  carrierCode: string;
  serviceCode: string;
  displayName: string;
  description: string | null;
  kind: ShippingRateKind;
  amount: bigint | null;
  currency: string;
  tiers: unknown; // jsonb — ShippingTier[] | null
  freeAboveAmount: bigint | null;
  pickupOnly: boolean;
  supportsCod: boolean;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  priority: number;
}

export interface CartShippingMetrics {
  totalWeightGrams: number;
  subtotalAmount: bigint;
}

export interface ShippingOption {
  rate_id: string;
  carrier_code: string;
  service_code: string;
  display_name: string;
  description: string | null;
  amount: string; // minor units
  currency: string;
  free: boolean;
  requires_pickup_point: boolean;
  supports_cod: boolean;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

function toBigInt(v: number | string | bigint | null | undefined): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === 'bigint') return v;
  return BigInt(Math.trunc(Number(v)));
}

/** Pick the first tier whose upper bound is ≥ the value; falls back to rate.amount. */
function lookupTier(
  tiers: ShippingTier[],
  value: bigint,
  key: 'max_weight_grams' | 'max_subtotal',
  fallback: bigint,
): bigint {
  const sorted = [...tiers].sort((a, b) => toNum(a[key]) - toNum(b[key]));
  for (const tier of sorted) {
    if (value <= BigInt(Math.trunc(toNum(tier[key])))) return toBigInt(tier.amount);
  }
  return fallback;
}

function toNum(v: number | string | undefined): number {
  return v === undefined ? Number.POSITIVE_INFINITY : Number(v);
}

function isApplicable(rate: ShippingRateRow, metrics: CartShippingMetrics): boolean {
  if (rate.minWeightGrams !== null && metrics.totalWeightGrams < rate.minWeightGrams) return false;
  if (rate.maxWeightGrams !== null && metrics.totalWeightGrams > rate.maxWeightGrams) return false;
  return true;
}

function computeAmount(rate: ShippingRateRow, metrics: CartShippingMetrics): bigint {
  const flat = toBigInt(rate.amount);
  switch (rate.kind) {
    case 'flat':
      return flat;
    case 'free_above_threshold':
      return rate.freeAboveAmount !== null && metrics.subtotalAmount >= rate.freeAboveAmount
        ? 0n
        : flat;
    case 'weight_based':
      return Array.isArray(rate.tiers)
        ? lookupTier(
            rate.tiers as ShippingTier[],
            BigInt(metrics.totalWeightGrams),
            'max_weight_grams',
            flat,
          )
        : flat;
    case 'price_based':
      return Array.isArray(rate.tiers)
        ? lookupTier(rate.tiers as ShippingTier[], metrics.subtotalAmount, 'max_subtotal', flat)
        : flat;
    default:
      return flat;
  }
}

/**
 * Filter applicable rates, compute amounts, sort by priority DESC then amount ASC.
 */
export function calculateShippingOptions(
  rates: ShippingRateRow[],
  metrics: CartShippingMetrics,
): ShippingOption[] {
  return rates
    .filter((r) => isApplicable(r, metrics))
    .map((r) => {
      const amount = computeAmount(r, metrics);
      return {
        option: {
          rate_id: r.id,
          carrier_code: r.carrierCode,
          service_code: r.serviceCode,
          display_name: r.displayName,
          description: r.description,
          amount: amount.toString(),
          currency: r.currency,
          free: amount === 0n,
          requires_pickup_point: r.pickupOnly,
          supports_cod: r.supportsCod,
          estimated_days_min: r.estimatedDaysMin,
          estimated_days_max: r.estimatedDaysMax,
        } satisfies ShippingOption,
        priority: r.priority,
        amount,
      };
    })
    .sort((a, b) => b.priority - a.priority || (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0))
    .map((x) => x.option);
}
