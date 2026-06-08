/**
 * `gift_cards` + `gift_card_transactions` — per `10-pricing-promotions.md` §3.7-3.8.
 *
 * A gift card is a pay-with-balance instrument (a TENDER, not a discount — it
 * never changes the tax base, per RULE-PRICING-014). The raw code is shown once
 * at issuance and never stored: we keep a hash plus a display prefix/last4.
 * Balance is the running figure; `gift_card_transactions` is the append-only
 * ledger that every issue/redeem/refund/topup writes, so the balance is always
 * reconstructable.
 *
 * `kind` distinguishes a purchased gift card from refund store-credit
 * (Q-PRICING-011: single table for MVP). Redemption at checkout creates a
 * `payments` row with `provider_code='gift_card'` for `min(total, balance)`.
 */

import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders } from './orders';

export const GIFT_CARD_STATUSES = [
  'active',
  'spent',
  'expired',
  'revoked',
  'pending_activation',
] as const;

export const GIFT_CARD_KINDS = ['gift', 'store_credit'] as const;

export const GIFT_CARD_TX_KINDS = [
  'issue',
  'redeem',
  'refund',
  'topup',
  'adjustment',
  'expire',
  'revoke',
] as const;

export const giftCards = pgTable(
  'gift_cards',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // gft_ NanoID
    /** SHA-256 hash of the raw code; raw code never stored. */
    codeHash: text('code_hash').notNull(),
    /** First 4 chars for display "ABCD-…-XXXX". */
    codePrefix: text('code_prefix').notNull(),
    codeLast4: text('code_last4').notNull(),
    kind: text('kind', { enum: GIFT_CARD_KINDS }).notNull().default('gift'),
    initialAmount: bigint('initial_amount', { mode: 'bigint' }).notNull(),
    balance: bigint('balance', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    status: text('status', { enum: GIFT_CARD_STATUSES }).notNull().default('active'),
    issuedToEmail: text('issued_to_email'),
    issuedToCustomerId: uuid('issued_to_customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    /** Set when the card was bought as a storefront product. */
    issuedByOrderId: uuid('issued_by_order_id').references(() => orders.id, { onDelete: 'set null' }),
    notes: text('notes'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_gift_cards_pub_id').on(t.tenantId, t.pubId),
    codeHashUnique: uniqueIndex('uq_gift_cards_code_hash').on(t.tenantId, t.codeHash),
    statusIdx: index('idx_gift_cards_status').on(t.tenantId, t.status, t.expiresAt),
    customerIdx: index('idx_gift_cards_customer')
      .on(t.issuedToCustomerId)
      .where(sql`issued_to_customer_id IS NOT NULL`),
  }),
);

export const giftCardTransactions = pgTable(
  'gift_card_transactions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    giftCardId: uuid('gift_card_id')
      .notNull()
      .references(() => giftCards.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: GIFT_CARD_TX_KINDS }).notNull(),
    /** Signed minor units: +issue/+refund/+topup, −redeem/−expire/−revoke. */
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    resultingBalance: bigint('resulting_balance', { mode: 'bigint' }).notNull(),
    notes: text('notes'),
    actorKind: text('actor_kind').notNull(), // 'admin' | 'customer' | 'system'
    actorId: uuid('actor_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cardIdx: index('idx_gift_card_transactions_card').on(t.giftCardId, t.occurredAt),
  }),
);

export type GiftCard = typeof giftCards.$inferSelect;
export type NewGiftCard = typeof giftCards.$inferInsert;
export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect;
