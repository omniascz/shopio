/**
 * Platform plans + limits (per `37-build-execution-plan.md` pricing tiers).
 *
 * The monetization scaffold: each tenant is on a plan (stored in
 * tenant.settings.plan, default 'free') that caps catalog size + monthly orders
 * and carries a transaction fee. This MVP defines the tiers, exposes plan +
 * usage to the admin, and SOFT-enforces the catalog cap on product creation.
 *
 * Real charging (a Stripe subscription billing the merchant for the plan +
 * the per-order fee) is the explicit follow-up — it needs the platform Stripe
 * account + the billing flow, out of scope here.
 */

export type PlanCode = 'free' | 'growth' | 'scale' | 'pro';

export interface Plan {
  code: PlanCode;
  name: string;
  priceEurMonth: number;
  /** Per-order platform fee (basis points of order total). */
  transactionFeeBps: number;
  /** null = unlimited. */
  maxProducts: number | null;
  maxOrdersPerMonth: number | null;
  features: string[];
}

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: 'free',
    name: 'Free',
    priceEurMonth: 0,
    transactionFeeBps: 50, // 0.5 %
    maxProducts: 50,
    maxOrdersPerMonth: 100,
    features: ['Katalog do 50 produktů', 'Zásilkovna', 'Dobírka + převod'],
  },
  growth: {
    code: 'growth',
    name: 'Growth',
    priceEurMonth: 29,
    transactionFeeBps: 0,
    maxProducts: 1000,
    maxOrdersPerMonth: 2000,
    features: ['Bez transakčního poplatku', 'Platební brány', 'Heureka/Zboží feedy', 'Slevové kupóny'],
  },
  scale: {
    code: 'scale',
    name: 'Scale',
    priceEurMonth: 99,
    transactionFeeBps: 0,
    maxProducts: 20000,
    maxOrdersPerMonth: 20000,
    features: ['B2B + NET splatnost', 'Marketplace', 'AI asistent', 'Vlastní doména'],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    priceEurMonth: 299,
    transactionFeeBps: 0,
    maxProducts: null,
    maxOrdersPerMonth: null,
    features: ['Neomezený katalog', 'API + webhooky', 'Předplatné', 'Prioritní podpora'],
  },
};

export const PLAN_ORDER: PlanCode[] = ['free', 'growth', 'scale', 'pro'];

export function planCodeOf(settings: unknown): PlanCode {
  const code = (settings as { plan?: string })?.plan;
  return code && code in PLANS ? (code as PlanCode) : 'free';
}

export function planOf(settings: unknown): Plan {
  return PLANS[planCodeOf(settings)];
}
