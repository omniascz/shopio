/**
 * Tax engine — VAT/DPH computation per `15-tax-compliance.md` §4.
 *
 * Pure function: (lines × address × rates × time) → tax result. No DB writes,
 * deterministic, cacheable. The caller resolves rates (DB lookup) and passes
 * them in; this module does the arithmetic + grouping only.
 *
 * Wave 1 MVP boundary:
 * - B2C only. Reverse charge / VAT-ID / OSS are stubbed (always false) until
 *   the customer + company entities land in a later wave.
 * - Single place-of-supply country resolved by the caller (ship-to, else
 *   tenant country). Multi-zone EU/NON_EU comes with OSS.
 *
 * Money is always BigInt minor units (haléře / cents). Per-line floor rounding
 * prevents penny drift when summing (per `15 §4.3`).
 */

export type TaxClassCode = 'standard' | 'reduced' | 'super_reduced' | 'zero' | 'exempt';

/** A resolved rate for one tax class, in basis points (2100 = 21 %). */
export interface ResolvedRate {
  taxClassCode: string;
  rateBasisPoints: number;
}

export interface TaxLineInput {
  /** Stable id echoed back in the result so the caller can map to order items. */
  ref: string;
  /** Net (exclusive) or gross (inclusive) per `priceIncludesTax` — total for the line, post-discount. */
  amount: bigint;
  taxClassCode: string;
}

export interface TaxComputationInput {
  lines: TaxLineInput[];
  /** Shipping fee (same gross/net convention as lines); 0 = none. */
  shippingAmount?: bigint;
  shippingTaxClass?: string;
  /** Rates keyed by tax_class_code, already resolved for the place of supply + time. */
  rates: ResolvedRate[];
  /** True when `amount`s are gross (VAT-inclusive) — CZ B2C default. */
  priceIncludesTax: boolean;
}

export interface TaxLineResult {
  ref: string;
  taxClassCode: string;
  taxRateBasisPoints: number;
  /** Net taxable base (exclusive of VAT). */
  baseAmount: bigint;
  taxAmount: bigint;
  /** Gross = base + tax. */
  grossAmount: bigint;
}

export interface TaxBreakdownEntry {
  taxClass: string;
  rateBasisPoints: number;
  baseAmount: bigint;
  taxAmount: bigint;
}

export interface TaxResult {
  isReverseCharge: false;
  lines: TaxLineResult[];
  shipping: TaxLineResult | null;
  totals: {
    /** Sum of net bases. */
    taxableAmount: bigint;
    taxAmount: bigint;
    /** Sum of gross (net + tax). */
    grossAmount: bigint;
  };
  breakdown: TaxBreakdownEntry[];
  warnings: string[];
}

const ZERO_RATE: ResolvedRate = { taxClassCode: 'zero', rateBasisPoints: 0 };

/**
 * Resolve the rate for a class, falling back to `standard`, then 0 % (per `15 §4` STAGE 4).
 */
function lookupRate(rates: ResolvedRate[], classCode: string, warnings: string[]): ResolvedRate {
  const exact = rates.find((r) => r.taxClassCode === classCode);
  if (exact) return exact;
  const std = rates.find((r) => r.taxClassCode === 'standard');
  if (std) {
    warnings.push(`No rate for class "${classCode}"; fell back to standard.`);
    return std;
  }
  warnings.push(`No rate for class "${classCode}" and no standard rate; charged 0 %.`);
  return ZERO_RATE;
}

/**
 * Compute VAT for a single amount given a rate and the inclusive/exclusive convention.
 *
 * Inclusive (gross input): net = floor(gross × 10000 / (10000 + rbp)); tax = gross − net.
 * Exclusive (net input):   tax = floor(net × rbp / 10000); gross = net + tax.
 */
function computeAmount(
  ref: string,
  amount: bigint,
  rate: ResolvedRate,
  priceIncludesTax: boolean,
): TaxLineResult {
  const rbp = BigInt(rate.rateBasisPoints);
  let base: bigint;
  let tax: bigint;
  if (priceIncludesTax) {
    base = (amount * 10000n) / (10000n + rbp); // BigInt division floors toward zero (amounts ≥ 0)
    tax = amount - base;
  } else {
    tax = (amount * rbp) / 10000n;
    base = amount;
  }
  return {
    ref,
    taxClassCode: rate.taxClassCode,
    taxRateBasisPoints: rate.rateBasisPoints,
    baseAmount: base,
    taxAmount: tax,
    grossAmount: base + tax,
  };
}

export function computeTax(input: TaxComputationInput): TaxResult {
  const warnings: string[] = [];

  const lines: TaxLineResult[] = input.lines.map((line) =>
    computeAmount(
      line.ref,
      line.amount,
      lookupRate(input.rates, line.taxClassCode, warnings),
      input.priceIncludesTax,
    ),
  );

  let shipping: TaxLineResult | null = null;
  if (input.shippingAmount && input.shippingAmount > 0n) {
    const shippingClass = input.shippingTaxClass ?? 'standard';
    shipping = computeAmount(
      'shipping',
      input.shippingAmount,
      lookupRate(input.rates, shippingClass, warnings),
      input.priceIncludesTax,
    );
  }

  const all = shipping ? [...lines, shipping] : lines;

  // STAGE 6: totals
  const totals = all.reduce(
    (acc, r) => ({
      taxableAmount: acc.taxableAmount + r.baseAmount,
      taxAmount: acc.taxAmount + r.taxAmount,
      grossAmount: acc.grossAmount + r.grossAmount,
    }),
    { taxableAmount: 0n, taxAmount: 0n, grossAmount: 0n },
  );

  // STAGE 7: breakdown grouped by rate
  const byRate = new Map<number, TaxBreakdownEntry>();
  for (const r of all) {
    const existing = byRate.get(r.taxRateBasisPoints);
    if (existing) {
      existing.baseAmount += r.baseAmount;
      existing.taxAmount += r.taxAmount;
    } else {
      byRate.set(r.taxRateBasisPoints, {
        taxClass: r.taxClassCode,
        rateBasisPoints: r.taxRateBasisPoints,
        baseAmount: r.baseAmount,
        taxAmount: r.taxAmount,
      });
    }
  }
  const breakdown = [...byRate.values()].sort((a, b) => b.rateBasisPoints - a.rateBasisPoints);

  return { isReverseCharge: false, lines, shipping, totals, breakdown, warnings };
}

/** Serialize a breakdown for JSONB storage (BigInt → string minor units). */
export function serializeBreakdown(
  breakdown: TaxBreakdownEntry[],
): Array<{ tax_class: string; rate_basis_points: number; base_amount: string; tax_amount: string }> {
  return breakdown.map((b) => ({
    tax_class: b.taxClass,
    rate_basis_points: b.rateBasisPoints,
    base_amount: b.baseAmount.toString(),
    tax_amount: b.taxAmount.toString(),
  }));
}
