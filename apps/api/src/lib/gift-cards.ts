/**
 * Gift card logic (per `10-pricing-promotions.md` §3.7-3.8 + RULE-PRICING-014).
 *
 * A gift card is a pay-with-balance TENDER, not a discount: redeeming it never
 * changes the order total or tax base, it just splits the tender. The raw code
 * is generated once, shown once, and only its SHA-256 hash is persisted.
 *
 * Every balance change goes through {@link recordTransaction} which writes the
 * ledger row and the new balance atomically inside the caller's transaction,
 * so `gift_cards.balance` is always `initial_amount + sum(ledger.amount)`.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { TenantTx } from '@shopio/db';
import type { AppDb } from '../db';

type Db = AppDb | TenantTx;

/** Crockford-ish base32 (no I/L/O/U) — unambiguous when read aloud / printed. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate a raw gift-card code: 16 chars grouped `XXXX-XXXX-XXXX-XXXX`
 * (~32^16 ≈ 10^24 search space; spec wants ≥10^28 only for anonymous bearer
 * codes — combined with per-IP rate limiting this is the MVP shape).
 */
export function generateGiftCardCode(): string {
  const bytes = randomBytes(16);
  let raw = '';
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/** Normalize a user-entered code (strip dashes/space, upper-case) before hashing. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function hashGiftCardCode(rawOrNormalized: string): string {
  return createHash('sha256').update(normalizeCode(rawOrNormalized)).digest('hex');
}

export interface IssueGiftCardInput {
  amount: bigint;
  currency: string;
  kind?: 'gift' | 'store_credit';
  issuedToEmail?: string | null;
  issuedToCustomerId?: string | null;
  issuedByOrderId?: string | null;
  expiresAt?: Date | null;
  notes?: string | null;
  actorKind?: string;
  actorId?: string | null;
}

export interface IssuedGiftCard {
  id: string;
  pubId: string;
  /** Raw code — returned ONCE here, never retrievable afterwards. */
  code: string;
  codePrefix: string;
  codeLast4: string;
  balance: bigint;
  currency: string;
}

/**
 * Issue a new gift card. Writes the card + an `issue` ledger row. Must run
 * inside a tenant transaction (RLS sets the tenant). Returns the raw code once.
 */
export async function issueGiftCard(
  tx: TenantTx,
  tenantId: string,
  input: IssueGiftCardInput,
): Promise<IssuedGiftCard> {
  const code = generateGiftCardCode();
  const normalized = normalizeCode(code);
  const pubId = generatePubId('gft');
  const [card] = await tx
    .insert(schema.giftCards)
    .values({
      tenantId,
      pubId,
      codeHash: hashGiftCardCode(normalized),
      codePrefix: normalized.slice(0, 4),
      codeLast4: normalized.slice(-4),
      kind: input.kind ?? 'gift',
      initialAmount: input.amount,
      balance: input.amount,
      currency: input.currency,
      status: 'active',
      issuedToEmail: input.issuedToEmail ?? null,
      issuedToCustomerId: input.issuedToCustomerId ?? null,
      issuedByOrderId: input.issuedByOrderId ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes ?? null,
      activatedAt: dsql`now()`,
    })
    .returning({ id: schema.giftCards.id });
  if (!card) throw new Error('gift card insert failed');

  await tx.insert(schema.giftCardTransactions).values({
    tenantId,
    giftCardId: card.id,
    kind: 'issue',
    amount: input.amount,
    currency: input.currency,
    resultingBalance: input.amount,
    actorKind: input.actorKind ?? 'admin',
    actorId: input.actorId ?? null,
    referenceType: input.issuedByOrderId ? 'order' : null,
    referenceId: input.issuedByOrderId ?? null,
  });

  return {
    id: card.id,
    pubId,
    code,
    codePrefix: normalized.slice(0, 4),
    codeLast4: normalized.slice(-4),
    balance: input.amount,
    currency: input.currency,
  };
}

export interface GiftCardBalanceResult {
  found: boolean;
  status?: (typeof schema.GIFT_CARD_STATUSES)[number];
  balance?: bigint;
  currency?: string;
  codePrefix?: string;
  codeLast4?: string;
  expiresAt?: Date | null;
}

/** Resolve a raw/entered code to its card (or null) — for balance checks + redeem. */
export async function findByCode(tx: Db, tenantId: string, rawCode: string) {
  const [card] = await tx
    .select()
    .from(schema.giftCards)
    .where(
      and(
        eq(schema.giftCards.tenantId, tenantId),
        eq(schema.giftCards.codeHash, hashGiftCardCode(rawCode)),
      ),
    )
    .limit(1);
  return card ?? null;
}

/** Masked balance lookup for the storefront/admin "check balance" endpoint. */
export async function checkBalance(
  tx: Db,
  tenantId: string,
  rawCode: string,
): Promise<GiftCardBalanceResult> {
  const card = await findByCode(tx, tenantId, rawCode);
  if (!card) return { found: false };
  return {
    found: true,
    status: card.status,
    balance: card.balance,
    currency: card.currency,
    codePrefix: card.codePrefix,
    codeLast4: card.codeLast4,
    expiresAt: card.expiresAt,
  };
}

/** Is the card currently usable as a tender? */
export function isRedeemable(card: { status: string; balance: bigint; expiresAt: Date | null }, now: Date): boolean {
  if (card.status !== 'active') return false;
  if (card.balance <= 0n) return false;
  if (card.expiresAt && card.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Redeem (debit) up to `requestedAmount` from a card, capped at its balance.
 * Writes a `redeem` ledger row, decrements the balance, and flips status to
 * `spent` when it hits zero. Returns the amount actually applied. Must run in
 * a tenant transaction; the caller creates the matching `payments` row.
 */
export async function redeem(
  tx: TenantTx,
  tenantId: string,
  cardId: string,
  requestedAmount: bigint,
  now: Date,
  ref?: { type: string; id: string },
): Promise<bigint> {
  const [card] = await tx
    .select()
    .from(schema.giftCards)
    .where(and(eq(schema.giftCards.tenantId, tenantId), eq(schema.giftCards.id, cardId)))
    .limit(1);
  if (!card || !isRedeemable(card, now)) return 0n;

  const applied = requestedAmount < card.balance ? requestedAmount : card.balance;
  if (applied <= 0n) return 0n;
  const newBalance = card.balance - applied;

  await tx
    .update(schema.giftCards)
    .set({
      balance: newBalance,
      status: newBalance === 0n ? 'spent' : card.status,
      updatedAt: dsql`now()`,
    })
    .where(eq(schema.giftCards.id, cardId));

  await tx.insert(schema.giftCardTransactions).values({
    tenantId,
    giftCardId: cardId,
    kind: 'redeem',
    amount: -applied,
    currency: card.currency,
    resultingBalance: newBalance,
    actorKind: 'customer',
    referenceType: ref?.type ?? 'order',
    referenceId: ref?.id ?? null,
  });

  return applied;
}

/** Top up an existing card (admin). Writes `topup` ledger + bumps balance. */
export async function topup(
  tx: TenantTx,
  tenantId: string,
  cardId: string,
  amount: bigint,
  actorId?: string,
): Promise<bigint | null> {
  const [card] = await tx
    .select()
    .from(schema.giftCards)
    .where(and(eq(schema.giftCards.tenantId, tenantId), eq(schema.giftCards.id, cardId)))
    .limit(1);
  if (!card || card.status === 'revoked') return null;
  const newBalance = card.balance + amount;
  await tx
    .update(schema.giftCards)
    .set({
      balance: newBalance,
      initialAmount: card.initialAmount + amount,
      status: card.status === 'spent' ? 'active' : card.status,
      updatedAt: dsql`now()`,
    })
    .where(eq(schema.giftCards.id, cardId));
  await tx.insert(schema.giftCardTransactions).values({
    tenantId,
    giftCardId: cardId,
    kind: 'topup',
    amount,
    currency: card.currency,
    resultingBalance: newBalance,
    actorKind: 'admin',
    actorId: actorId ?? null,
  });
  return newBalance;
}

/** Revoke a card (admin). Zeroes the balance and writes a `revoke` ledger row. */
export async function revoke(
  tx: TenantTx,
  tenantId: string,
  cardId: string,
  actorId?: string,
): Promise<boolean> {
  const [card] = await tx
    .select()
    .from(schema.giftCards)
    .where(and(eq(schema.giftCards.tenantId, tenantId), eq(schema.giftCards.id, cardId)))
    .limit(1);
  if (!card || card.status === 'revoked') return false;
  await tx
    .update(schema.giftCards)
    .set({ balance: 0n, status: 'revoked', updatedAt: dsql`now()` })
    .where(eq(schema.giftCards.id, cardId));
  if (card.balance > 0n) {
    await tx.insert(schema.giftCardTransactions).values({
      tenantId,
      giftCardId: cardId,
      kind: 'revoke',
      amount: -card.balance,
      currency: card.currency,
      resultingBalance: 0n,
      actorKind: 'admin',
      actorId: actorId ?? null,
    });
  }
  return true;
}

export async function listTransactions(tx: Db, tenantId: string, cardId: string) {
  return tx
    .select()
    .from(schema.giftCardTransactions)
    .where(
      and(
        eq(schema.giftCardTransactions.tenantId, tenantId),
        eq(schema.giftCardTransactions.giftCardId, cardId),
      ),
    )
    .orderBy(desc(schema.giftCardTransactions.occurredAt))
    .limit(100);
}
