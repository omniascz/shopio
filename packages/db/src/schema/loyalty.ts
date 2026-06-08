/**
 * Loyalty / store credit (per `19-marketing-seo.md` + `10-pricing` MVP).
 *
 * A single append-only ledger per customer. Balance = sum(amount) (minor
 * currency units). Positive entries: `earn` (a % of a paid order), `grant`
 * (manual goodwill), `refund` (store-credit refund). Negative: `redeem`
 * (applied at checkout as a tender — reduces the amount charged to the gateway,
 * the order total + VAT stay intact). Earn is idempotent per order via the
 * partial unique index below.
 *
 * Store credit is a TENDER, not a discount — it never changes the tax base
 * (RULE: gift-card/credit semantics, distinct from coupons in `10`).
 */

import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders } from './orders';

export const LOYALTY_KINDS = ['earn', 'redeem', 'grant', 'refund', 'expire', 'adjust'] as const;

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // lyt_ NanoID
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: LOYALTY_KINDS }).notNull(),
    /** Signed minor units: + accrual, − redemption. */
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_loyalty_tx_pub_id').on(t.tenantId, t.pubId),
    customerIdx: index('idx_loyalty_tx_customer').on(t.tenantId, t.customerId, t.createdAt),
    // One earn accrual per order (idempotent re-runs across paid paths).
    earnPerOrder: uniqueIndex('uq_loyalty_earn_per_order')
      .on(t.orderId)
      .where(sql`kind = 'earn'`),
  }),
);

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
