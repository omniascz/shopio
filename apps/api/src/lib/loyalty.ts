/**
 * Loyalty / store-credit ledger logic (per `19` MVP).
 *
 * Balance = sum of signed `loyalty_transactions.amount` (minor units). Earn is
 * a configurable % of a paid order, accrued once per order (idempotent across
 * the several order-paid code paths). Redemption is a tender applied at
 * checkout — it never touches the tax base.
 */

import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDb } from '../db';
import type { TenantTx } from '@shopio/db';

type Db = AppDb | TenantTx;

/** Read the tenant's loyalty config from settings (earn rate in basis points). */
function loyaltyConfig(settings: unknown): { enabled: boolean; earnRateBps: number } {
  const s = (settings ?? {}) as { loyalty?: { enabled?: boolean; earn_rate_bps?: number } };
  const earnRateBps = Number(s.loyalty?.earn_rate_bps ?? 0);
  return { enabled: Boolean(s.loyalty?.enabled) && earnRateBps > 0, earnRateBps };
}

/** Current store-credit balance (minor units). */
export async function getLoyaltyBalance(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<bigint> {
  const [row] = await db
    .select({ balance: dsql<string>`coalesce(sum(${schema.loyaltyTransactions.amount}), 0)` })
    .from(schema.loyaltyTransactions)
    .where(
      and(
        eq(schema.loyaltyTransactions.tenantId, tenantId),
        eq(schema.loyaltyTransactions.customerId, customerId),
      ),
    );
  return BigInt(row?.balance ?? '0');
}

export async function listLoyaltyTransactions(db: Db, tenantId: string, customerId: string) {
  return db
    .select()
    .from(schema.loyaltyTransactions)
    .where(
      and(
        eq(schema.loyaltyTransactions.tenantId, tenantId),
        eq(schema.loyaltyTransactions.customerId, customerId),
      ),
    )
    .orderBy(desc(schema.loyaltyTransactions.createdAt))
    .limit(50);
}

/**
 * Accrue earned credit for a paid order. Idempotent: the partial unique index
 * on (order_id) WHERE kind='earn' makes a second call a no-op. Safe to call
 * from every order-paid path (provider capture, Stripe webhook, manual mark).
 * Uses the superuser db (RLS-bypassing) — consistent with the paid-path code.
 */
export async function grantEarnedCredit(
  db: AppDb,
  tenantId: string,
  orderId: string,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [order] = await db
    .select({
      customerId: schema.orders.customerId,
      total: schema.orders.totalAmount,
      currency: schema.orders.currency,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.id, orderId)))
    .limit(1);
  if (!order?.customerId) return; // guest order — nobody to credit

  const [tenant] = await db
    .select({ settings: schema.tenants.settings })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  const cfg = loyaltyConfig(tenant?.settings);
  if (!cfg.enabled) return;

  const earned = (order.total * BigInt(cfg.earnRateBps)) / 10000n;
  if (earned <= 0n) return;

  try {
    await db
      .insert(schema.loyaltyTransactions)
      .values({
        tenantId,
        pubId: generatePubId('lyt'),
        customerId: order.customerId,
        orderId,
        kind: 'earn',
        amount: earned,
        currency: order.currency,
        note: 'Body za nákup',
      })
      .onConflictDoNothing();
  } catch (err) {
    log?.warn({ err, orderId }, 'loyalty.earn_failed');
  }
}

/** Manual / refund / adjustment credit grant. */
export async function grantCredit(
  db: Db,
  input: {
    tenantId: string;
    customerId: string;
    amount: bigint; // signed
    currency: string;
    kind: (typeof schema.loyaltyTransactions.$inferInsert)['kind'];
    note?: string | null;
    orderId?: string | null;
  },
): Promise<void> {
  await db.insert(schema.loyaltyTransactions).values({
    tenantId: input.tenantId,
    pubId: generatePubId('lyt'),
    customerId: input.customerId,
    orderId: input.orderId ?? null,
    kind: input.kind,
    amount: input.amount,
    currency: input.currency,
    note: input.note ?? null,
  });
}

/**
 * Redeem store credit against an order (negative entry). Caller must have
 * validated `amount` ≤ balance and ≤ order total. Runs inside the checkout tx.
 */
export async function redeemCredit(
  tx: TenantTx,
  input: {
    tenantId: string;
    customerId: string;
    orderId: string;
    amount: bigint; // positive value to redeem
    currency: string;
  },
): Promise<void> {
  if (input.amount <= 0n) return;
  await tx.insert(schema.loyaltyTransactions).values({
    tenantId: input.tenantId,
    pubId: generatePubId('lyt'),
    customerId: input.customerId,
    orderId: input.orderId,
    kind: 'redeem',
    amount: -input.amount,
    currency: input.currency,
    note: 'Uplatnění kreditu',
  });
}
