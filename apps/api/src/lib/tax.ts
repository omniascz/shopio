/**
 * Tax engine — VAT/DPH computation per `15-tax-compliance.md` §4.
 *
 * Pure function: (lines × address × rates × time) → tax result. No DB writes,
 * deterministic, cacheable. The caller resolves rates (DB lookup) and passes
 * them in; this module does the arithmetic + grouping only.
 *
 * Wave 1 MVP boundary:
 * - Reverse charge (per `15 §4` + `21`): an EU B2B sale to a customer with a
 *   valid VAT ID in a *different* member state is zero-rated — the buyer
 *   self-assesses. The caller sets `reverseCharge`; lines are then charged 0 %
 *   and `isReverseCharge` is true (the invoice carries the legal note).
 * - Place of supply (ship-to, else tenant country) is resolved by the caller via
 *   `tax-resolver`. OSS = resolving the destination country's rates (works when
 *   those rates are configured); threshold tracking is a later slice.
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
  /** EU B2B reverse charge: zero-rate every line (buyer self-assesses). When
   * the input is gross, the VAT is stripped at the line's normal rate so the
   * buyer pays the ex-VAT price. */
  reverseCharge?: boolean;
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
  isReverseCharge: boolean;
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
  reverseCharge = false,
): TaxLineResult {
  const rbp = BigInt(rate.rateBasisPoints);
  let base: bigint;
  let tax: bigint;
  if (reverseCharge) {
    // Zero-rated: strip VAT from a gross input so the buyer pays ex-VAT; an
    // exclusive input is already net. No VAT is charged either way.
    base = priceIncludesTax ? (amount * 10000n) / (10000n + rbp) : amount;
    tax = 0n;
  } else if (priceIncludesTax) {
    base = (amount * 10000n) / (10000n + rbp); // BigInt division floors toward zero (amounts ≥ 0)
    tax = amount - base;
  } else {
    tax = (amount * rbp) / 10000n;
    base = amount;
  }
  return {
    ref,
    taxClassCode: reverseCharge ? 'reverse_charge' : rate.taxClassCode,
    taxRateBasisPoints: reverseCharge ? 0 : rate.rateBasisPoints,
    baseAmount: base,
    taxAmount: tax,
    grossAmount: base + tax,
  };
}

export function computeTax(input: TaxComputationInput): TaxResult {
  const warnings: string[] = [];

  const rc = input.reverseCharge ?? false;
  const lines: TaxLineResult[] = input.lines.map((line) =>
    computeAmount(
      line.ref,
      line.amount,
      lookupRate(input.rates, line.taxClassCode, warnings),
      input.priceIncludesTax,
      rc,
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
      rc,
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

  return { isReverseCharge: rc, lines, shipping, totals, breakdown, warnings };
}

/** EU member states (ISO 3166-1 alpha-2) — for reverse-charge eligibility. */
const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

export function isEuCountry(code: string | null | undefined): boolean {
  return code != null && EU_COUNTRIES.has(code.toUpperCase());
}

/**
 * Decide whether an EU B2B order is reverse-charged: the buyer is a company with
 * a VAT ID, established in an EU member state *other than* the supplier's, and
 * (recommended) VIES-validated. Domestic B2B is NOT reverse-charged.
 */
export function qualifiesForReverseCharge(args: {
  supplierCountry: string;
  buyerCountry: string | null | undefined;
  buyerHasVatId: boolean;
  vatValidated?: boolean;
}): boolean {
  if (!args.buyerHasVatId) return false;
  if (!isEuCountry(args.supplierCountry) || !isEuCountry(args.buyerCountry)) return false;
  if (args.buyerCountry!.toUpperCase() === args.supplierCountry.toUpperCase()) return false;
  // If a validation flag is provided it must be true; if absent we trust the ID.
  return args.vatValidated !== false;
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
