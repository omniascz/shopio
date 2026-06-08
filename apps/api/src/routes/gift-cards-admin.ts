/**
 * Admin gift card management — per `10-pricing-promotions.md` §7.5.
 *   GET    /admin/gift-cards
 *   POST   /admin/gift-cards                 — issue (raw code returned ONCE)
 *   GET    /admin/gift-cards/{pubId}
 *   GET    /admin/gift-cards/{pubId}/transactions
 *   POST   /admin/gift-cards/{pubId}/topup
 *   POST   /admin/gift-cards/{pubId}/revoke
 *   POST   /admin/gift-cards/check-balance   — validate code → masked balance
 *
 * The raw code is shown once at issuance and never retrievable afterwards
 * (only prefix + last4). Gift cards are a TENDER, not a discount.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import {
  checkBalance,
  issueGiftCard,
  listTransactions,
  revoke as revokeCard,
  topup as topupCard,
} from '../lib/gift-cards';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const minor = z.union([z.string(), z.number()]).transform((v) => BigInt(v));

const IssueBody = z.object({
  amount: minor,
  currency: z.string().length(3).default('CZK'),
  kind: z.enum(['gift', 'store_credit']).default('gift'),
  issuedToEmail: z.string().email().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const TopupBody = z.object({ amount: minor });
const CheckBody = z.object({ code: z.string().min(4).max(40) });

export async function registerGiftCardAdminRoutes(
  app: FastifyInstance,
  opts: PluginOptions,
): Promise<void> {
  const rlsDb = getRlsDb(opts.config);

  app.get(
    '/api/2026-05-20/admin/gift-cards',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const rows = await withTenant(rlsDb, tenantId, (tx) =>
        tx
          .select()
          .from(schema.giftCards)
          .where(eq(schema.giftCards.tenantId, tenantId))
          .orderBy(desc(schema.giftCards.createdAt))
          .limit(200),
      );
      return reply.send({ data: { gift_cards: rows.map(serialize) } });
    },
  );

  app.post(
    '/api/2026-05-20/admin/gift-cards',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = IssueBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const i = parsed.data;
      if (i.amount <= 0n) {
        return reply.code(422).send({ error: { code: 'INVALID_AMOUNT', message: 'Částka musí být kladná' } });
      }
      const issued = await withTenant(rlsDb, tenantId, (tx) =>
        issueGiftCard(tx, tenantId, {
          amount: i.amount,
          currency: i.currency,
          kind: i.kind,
          issuedToEmail: i.issuedToEmail ?? null,
          expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
          notes: i.notes ?? null,
          actorKind: 'admin',
          actorId: req.auth!.userId ?? null,
        }),
      );
      return reply.code(201).send({
        data: {
          id: issued.pubId,
          // Raw code shown ONCE — surface it explicitly so the UI can copy/print.
          code: issued.code,
          code_prefix: issued.codePrefix,
          code_last4: issued.codeLast4,
          balance: issued.balance.toString(),
          currency: issued.currency,
        },
      });
    },
  );

  app.get<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/gift-cards/:pubId',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const card = await loadByPub(rlsDb, tenantId, req.params.pubId);
      if (!card) return notFound2(reply, 'GIFT_CARD_NOT_FOUND');
      return reply.send({ data: serialize(card) });
    },
  );

  app.get<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/gift-cards/:pubId/transactions',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const card = await loadByPubTx(tx, tenantId, req.params.pubId);
        if (!card) return null;
        const txs = await listTransactions(tx, tenantId, card.id);
        return txs;
      });
      if (!result) return notFound2(reply, 'GIFT_CARD_NOT_FOUND');
      return reply.send({ data: { transactions: result.map(serializeTx) } });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/gift-cards/:pubId/topup',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = TopupBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      if (parsed.data.amount <= 0n) {
        return reply.code(422).send({ error: { code: 'INVALID_AMOUNT', message: 'Částka musí být kladná' } });
      }
      const balance = await withTenant(rlsDb, tenantId, async (tx) => {
        const card = await loadByPubTx(tx, tenantId, req.params.pubId);
        if (!card) return undefined;
        return topupCard(tx, tenantId, card.id, parsed.data.amount, req.auth!.userId ?? undefined);
      });
      if (balance === undefined) return notFound2(reply, 'GIFT_CARD_NOT_FOUND');
      if (balance === null) {
        return reply.code(409).send({ error: { code: 'GIFT_CARD_REVOKED', message: 'Karta je zrušená' } });
      }
      return reply.send({ data: { balance: balance.toString() } });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/gift-cards/:pubId/revoke',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const ok = await withTenant(rlsDb, tenantId, async (tx) => {
        const card = await loadByPubTx(tx, tenantId, req.params.pubId);
        if (!card) return undefined;
        return revokeCard(tx, tenantId, card.id, req.auth!.userId ?? undefined);
      });
      if (ok === undefined) return notFound2(reply, 'GIFT_CARD_NOT_FOUND');
      if (!ok) return reply.code(409).send({ error: { code: 'ALREADY_REVOKED', message: 'Již zrušeno' } });
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/2026-05-20/admin/gift-cards/check-balance',
    { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] },
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = CheckBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const result = await withTenant(rlsDb, tenantId, (tx) =>
        checkBalance(tx, tenantId, parsed.data.code),
      );
      if (!result.found) return notFound2(reply, 'GIFT_CARD_NOT_FOUND');
      return reply.send({
        data: {
          status: result.status,
          balance: result.balance?.toString(),
          currency: result.currency,
          masked: `${result.codePrefix}-…-${result.codeLast4}`,
          expires_at: result.expiresAt,
        },
      });
    },
  );
}

async function loadByPub(rlsDb: ReturnType<typeof getRlsDb>, tenantId: string, pubId: string) {
  return withTenant(rlsDb, tenantId, (tx) => loadByPubTx(tx, tenantId, pubId));
}

async function loadByPubTx(
  tx: Parameters<Parameters<ReturnType<typeof getRlsDb>['transaction']>[0]>[0],
  tenantId: string,
  pubId: string,
) {
  const [card] = await tx
    .select()
    .from(schema.giftCards)
    .where(and(eq(schema.giftCards.tenantId, tenantId), eq(schema.giftCards.pubId, pubId)))
    .limit(1);
  return card ?? null;
}

function serialize(c: typeof schema.giftCards.$inferSelect) {
  return {
    id: c.pubId,
    code_masked: `${c.codePrefix}-…-${c.codeLast4}`,
    kind: c.kind,
    initial_amount: c.initialAmount.toString(),
    balance: c.balance.toString(),
    currency: c.currency,
    status: c.status,
    issued_to_email: c.issuedToEmail,
    notes: c.notes,
    expires_at: c.expiresAt,
    created_at: c.createdAt,
  };
}

function serializeTx(t: typeof schema.giftCardTransactions.$inferSelect) {
  return {
    kind: t.kind,
    amount: t.amount.toString(),
    currency: t.currency,
    resulting_balance: t.resultingBalance.toString(),
    reference_type: t.referenceType,
    notes: t.notes,
    occurred_at: t.occurredAt,
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' } });
}
function notFound2(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
